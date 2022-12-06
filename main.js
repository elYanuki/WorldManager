/*************************************************************************************************************

USE: Main/Server/Backend process for worldmanager, handels data collection and saving
AUTHOR: Yanik Kendler
DEPENDS ON: electron, fileSystem

***************************************************************************************************************/
const { v4: uuidv4 } = require('uuid');

const { app, Menu, BrowserWindow, ipcMain} = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { dialog } = require('electron')


const home = os.homedir()

const managerFolder = home + "/Documents/WorldManager"

//UNUSED Custom Titelbar
/* const { setupTitlebar, attachTitlebarToWindow } = require("custom-electron-titlebar/main")
setupTitlebar(); */

let win

let worldData // json data of selected world read from file
let selectedWorldID = 0 // id of selected world in list of worlds read from storrage

let saveStatus = 1 // 1 if everything is saved - used for popup on close

let folderContent = []// array of json file names read from storrage
let worldList = [] // array of actuall world names read from json files above

let worldPath // path to json file of selected world

const createWindow = () => {
    win = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        spellcheck: true
      },
      icon:'icon.png',
      //UNUSED custom titelbar
      /* titleBarStyle: 'hidden', */
      /* titleBarOverlay: {
        color: '#2f3241',
        symbolColor: '#74b1be',
        height: 40
      }, */
      minHeight: 600,
      minWidth: 800,
      backgroundColor: "#8d785f", // color thats shown until loading in background is done and content is displayed - win.once('ready-to-show'
      show: false,
    })

    win.on('ready-to-show', () => {
      sendWorldList()
      win.show()
    })

    win.setMenuBarVisibility(false) //unnecesary on selection screen and potentially breaking (delete world)

    //UNUSED custom titelbar
    /* attachTitlebarToWindow(win); */

    //!not working
    /* win.session.setSpellCheckerLanguages(['de-US', 'de']) */

    win.maximize();
  
    win.loadFile('./public/index.html')
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  //template
  ipcMain.on('client-to-server', (_event, value) => {
    console.log("client to server recieved");
  })

  //recieves world id and sends world to client
  ipcMain.on('select-world', (_event, id) => {
    worldData = {}
    
    if(id > folderContent.length) return //world (id) doesnt exist
    
    worldPath = managerFolder + "/" + folderContent[id]
    
    console.log("selecting world", id, "at", worldPath);
    
    if (fs.existsSync(worldPath)) { //checks if selected world exists
      fs.readFile(worldPath, 'utf-8', (err, data_string) => {
        if (err) throw err;
        if(data_string != null && data_string != undefined && data_string != ""){
          worldData = JSON.parse(data_string)
          console.log(worldData);
          
          selectedWorldID = id
          win.webContents.send('world', JSON.stringify(worldData))
          
          win.setMenuBarVisibility(true)

          sendWikiEntries()

          win.webContents.send('wiki-entry', JSON.stringify(worldData.entries[0]))
          }
      })
    }
  })

  //recieves name for new world and adds file and data
  ipcMain.on('add-world', (_event, name) => {
    if(name == undefined) return

    folderContent.push(name + ".json")
    worldList.push(name)

    worldPath = managerFolder + "/" + folderContent[folderContent.length-1]

    worldData = {
      "name" : name,
      "markers" : [],
      "entries" : [{
        "name" : name,
        "category" : "world",
        "uuid" : uuidv4(),
        "data" : {time: Date.now(), blocks:[], version: '2.25.0'}
      }],
      "map" : null
    }

    selectedWorldID = folderContent.length
    win.webContents.send('world', JSON.stringify(worldData))
    win.setMenuBarVisibility(true)
    
    updateJSON()
  })

  ipcMain.on('add-entry', (_event, name, category) => {
    if(name == undefined) return

    newEntry = {
      "name" : name,
      "category" : "unused for now",
      "uuid" : uuidv4(),
      "data" : {time: Date.now(), blocks:[], version: '2.25.0'}
    }

    worldData.entries.push(newEntry)

    sendWikiEntries()

    win.webContents.send('wiki-entry', JSON.stringify(worldData.entries[worldData.entries.length-1]))
  })

  ipcMain.on('delete-entry', (_event, uuid) => {
    console.log("deleting world", uuid);

    //translates uuid back to entry index
    for (let i = 0; i < worldData.entries.length; i++) {
      if(worldData.entries[i].uuid == uuid){
        worldData.entries.splice(i, 1) //deletes selected entry from varaible data

        sendWikiEntries()
        win.webContents.send('wiki-entry', JSON.stringify(worldData.entries[0]))

        return
      }
    }

    console.log("entry doesnt exist");
  })
  
  //tells server to send next wiki entry
  ipcMain.on('select-entry', (_event, uuid) => {
    console.log("requesting entry", uuid);

    console.log(worldData.entries);

    //translates uuid back to entry index
    for (let i = 0; i < worldData.entries.length; i++) {
      if(worldData.entries[i].uuid == uuid){
        win.webContents.send('wiki-entry', JSON.stringify(worldData.entries[i]))
        console.log("found", worldData.entries[i].data.blocks);
        return
      }
    }
    
    console.log("entry doesnt exist");
    win.webContents.send('wiki-entry', null)
  })
  
  //saves wiki entry
  ipcMain.on('save-entry', (_event, data, newName, id) => {
    console.log("getting new wiki data");

    for (let i = 0; i < worldData.entries.length; i++) {
      if(worldData.entries[i].uuid == id){
        worldData.entries[i].data = JSON.parse(data)
        worldData.entries[i].name = newName
        console.log("found");
        return
      }
    }
    
    console.log("entry doesnt exist");
  })

  ipcMain.on('save-world-name', (_event, name) => {
    worldData.name = name
  })

  ipcMain.on('set-map-image', (_event, map) => {
    worldData.map = map
  })
  
  ipcMain.on('set-save-status', (_event, status) => {
    saveStatus = status
    console.log("savestatus now ", status);
  })

  ipcMain.on('map-markers', (_event, data) => {
    worldData.markers = JSON.parse(data)
  })

  ///tells server to write all data stored in the worldData variable to the file
  ipcMain.on('save', (_event) => {
    updateJSON()
    worldList[selectedWorldID] = worldData.name
    saveStatus = 1
    //TODO possible problem when saving of entry takes too long data gets write nbefore entry is recieved
  })

  ipcMain.on('load-home', (_event) => {
    loadHome()
  })

  function sendWikiEntries(){
    let wikiEntryList = []

    worldData.entries.forEach(elem => { //construct array of only name and uuid
      wikiEntryList.push({name: elem.name, uuid: elem.uuid})
    });

    wikiEntryList.sort()

    win.webContents.send('wiki-entry-list', JSON.stringify(wikiEntryList))
  }
  
  function loadHome(){
    if (saveStatus == 0) {/// unsaved changes
      let confirm = dialog.showMessageBox({//popup
          title: "WorldManager",
          message: "close world without saving?",
          buttons: ["continue editing", "dont save"],
          /* icon: "./icon.png", */
          noLink: true,
          type: "warning"
      })
      .then((data)=>{
        if(data.response == 1){//dont save
          worldData = {} //makes sure data is cleared
  
          sendWorldList()
  
          saveStatus = 1 //everything saved
        }
      })
    }
    else{//no unsaved changes
      sendWorldList()
    }
  }

  //prompt when trying to close window whilest having unsaved changes
  win.on('close', function (event) {
    if (saveStatus == 0) {//unsaved changes
        event.preventDefault();
        let confirm = dialog.showMessageBox({//popup
            title: "WorldManager",
            message: "close without saving?",
            buttons: ["continue editing", "dont save"],
            /* icon: "./icon.png", */
            noLink: true,
            type: "warning"
        })
        .then((data)=>{
          if(data.response == 1){//dont save
            app.exit();
          }
        })
    }
    else {//everything saved already
      app.exit();
    }
  });

  ///reads content of WorldManger folder
  try {
    if (!fs.existsSync(managerFolder)) {//folder doesnt exist yet
      fs.mkdirSync(managerFolder);
    }
    else{
      folderContent =  fs.readdirSync(managerFolder) ? fs.readdirSync(managerFolder) : []
  
      for (let i = 0; i < folderContent.length; i++) {//reads content of every file and constructs array of worldnames
        if (fs.existsSync(managerFolder + "/" + folderContent[i])) {
          fs.readFile(managerFolder + "/"  + folderContent[i], 'utf-8', (err, data_string) => {
              if (err) throw err;
  
              worldList[i] = JSON.parse(data_string).name
          })
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
})

function deleteWorld(){
  let confirm = dialog.showMessageBox({//popup
    title: "WorldManager",
    message: "You sure you want to delete World " + worldData.name,
    buttons: ["delete", "cancel"],
    /* icon: "./icon.png", */
    noLink: true,
    type: "warning"
  })
  .then((data)=>{
    if(data.response == 0){//delete
      fs.unlink(managerFolder + "/" + folderContent[selectedWorldID], function (err) {
        if (err) throw err;
        else console.log('World deleted!');

        console.log(worldList, folderContent, selectedWorldID);
        
        for (let i = 0; i < folderContent.length; i++) {//reads content of every file and constructs array of worldnames
          worldList.splice(selectedWorldID,1)
          folderContent.splice(selectedWorldID,1)
        }
        
        console.log(worldList, folderContent);

        sendWorldList()
      });
    }
  })
}

function sendWorldList(){
  win.setMenuBarVisibility(false)
  win.webContents.send('world-list', JSON.stringify(worldList), JSON.stringify(folderContent))
}

const isMac = process.platform === 'darwin' //donno man copied tis

const template = [
  ...(isMac ? [{
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }] : []),
  {
    label: 'World',
    submenu: [
      {
        label: 'Exit', //back to homescreen
        click() {loadHome()},
      },
      {
        label: 'Save', //send requests for all data to client
        click() {win.webContents.send('request-save-data')},
        accelerator: 'CommandOrControl+S',
      },
      {
        label: 'Delete',
        click() {deleteWorld()},
      }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      ...(isMac ? [
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Speech',
          submenu: [
            { role: 'startSpeaking' },
            { role: 'stopSpeaking' }
          ]
        }
      ] : [
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ])
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
      { type: 'separator' },
      { role: 'minimize' ,accelerator: 'CommandOrControl+Shift+M'},
      { role: 'close' ,accelerator: 'CommandOrControl+Shift+W'}
    ]
  },
]

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)

///Writes all data from "WorldData" variable into world file located in "ManagerFolder"
function updateJSON(){
  console.log("updating json, data: ", worldData);
  fs.writeFile(worldPath, JSON.stringify(worldData, null, 2), 'utf8', (error=>{
    if(error) throw error;
  }))
}