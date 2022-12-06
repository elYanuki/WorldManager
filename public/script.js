/**************************************************************************************************************

USE: clientsied functions of worldmanger recieves data from server and displays it gets data updates from client and sends them to server
LINKED FROM: index.html
AUTHOR: Yanik Kendler
DEPENDS ON: editor.js, electron.js

***************************************************************************************************************/

//dom calls
const navMarker = document.getElementById("nav-marker") //bar that indicates what view u are in
const wiki = document.getElementById("wiki")
const map = document.getElementById("map")
const openClose = document.getElementById("open-close")
const aside = document.querySelector("#wiki aside")
const asideContent = document.querySelector("#wiki aside .content")
const worldname = document.getElementById("worldname")
const saveInfo = document.getElementById("save-info")
const mapInput = document.querySelector("#map-image-input")
const mapImage = document.querySelector("#map-image")
const noMapImageButton = document.getElementById("no-map-image-button")
const mapControls = document.getElementById("map-controls")
const mapContainer = document.getElementById("map-container")
const markerEditButton = document.getElementById("marker-edit-button")
const markerEditor = document.getElementById("map-marker-editor")
const editModeToggel = document.getElementById("toggel-editmode")
const globalCursorElem = document.getElementById("global-cursor")
const worldList = document.getElementById("world-list")
const home = document.getElementById("home")
const newWorld = document.getElementById("new-world")
const newWorldError = newWorld.querySelector(".error")
const newWorldInput = newWorld.querySelector("input")
const entryNameInput = document.querySelector('#entry-name input')

let mode = 0 //0 - map, 1 - wiki
let editmode = 0 //0 - edit, 1 - view
let contentSaved = true
let asideVisible = true

let mapMarkers = [] //json data of all map markers
let worlds = [] //list of all worlds
let worldFiles = [] //list of all world file names
let wikiEntries = [] //list of json objects of every entry

let currentEntry = undefined

let editor
window.addEventListener("DOMContentLoaded", () => {
  initEditor()

  //exits and confirms worldname on enter press
  worldname.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      event.preventDefault()
      worldname.blur()
    }
  })
})

globalCursor("wait") //waits until content finished loading

//sets indicator to correct with and pos
navMarker.style.width = `calc(${
  document.querySelectorAll("nav ul li p")[0].clientWidth
}px + .8rem)`
navMarker.style.left = `calc(50% - ${navMarker.clientWidth}px - 1.5rem)`

//---------- DATA FROM SERVER ----------//

//#region

///tells client to collect all data and send to server for save to file
window.electronAPI.requestSaveData((_event) => {
  saveWorld()
})

window.electronAPI.wikiEntry((_event, data) => {
  if (data != null) {
    editor.isReady
      .then(() => {
        let jsonData = JSON.parse(data)
        console.log("recieved wikientry:", jsonData)
        currentEntry = jsonData.uuid
        entryNameInput.value = jsonData.name
    
        if(jsonData.data.blocks.length > 0){
          editor.render(jsonData.data)
        }
        else{
          editor.clear()
        }

        let entryListElems = asideContent.querySelectorAll('li')
        for (let i = 0; i < wikiEntries.length; i++) {
          if(wikiEntries[i].uuid == currentEntry){
            entryListElems[i].classList.add("selected")
          }
          else{
            entryListElems[i].classList.remove("selected")
          }
        }
      })
      .catch((reason) => {
        console.log(`Editor.js initialization failed because of ${reason}`)
      });
  }
})

window.electronAPI.wikiEntryList((_event, data) => {
  console.log("wikientries recieved")

  wikiEntries = JSON.parse(data)
  
  console.log(wikiEntries);
  
  reloadWikiEntries()

  //sets values for "linksTo" selector for mapmarkers
  let selectHTML = '<option value="null">nothing</option>'
  for (let i = 0; i < wikiEntries.length; i++) {
    selectHTML += `<option value="${wikiEntries[i].uuid}">${wikiEntries[i].name}</option>`
  }
  markerEditor.querySelector(".marker-link").innerHTML = selectHTML
})

///all the data of world that was selected
window.electronAPI.world((_event, data) => {
  let jsonData = JSON.parse(data)

  console.log("recieved world", jsonData)

  home.style.display = "none" //hides homescreen

  //clears all fields in case one set of data is non existent in newly loadet world (eg. no wiki data would result in the previous one still beeing displayed)
  mapImage.style.backgroundImage = ``
  noMapImageButton.style.display = "block"
  mapImage.style.display = "none"
  mapControls.style.opacity = 0
  mapMarkers = {}
  setMapZoom(10)

  worldname.value = jsonData.name

  if (jsonData.map != null) {
    //null is default non existen value
    mapImage.style.backgroundImage = `url(${jsonData.map})`
    noMapImageButton.style.display = "none"
    mapImage.style.display = "block"
    mapControls.style.opacity = 1

    //reads size of string encodet image
    var i = new Image()
    i.onload = function () {
      mapImage.style.aspectRatio = i.width + " / " + i.height //making zooming or overflow cool or smth idk anymore
    }
    i.src = jsonData.map
  }

  console.log("wikientries", jsonData.entries)

  wikiEntries = jsonData.entries
  reloadWikiEntries()
  entryNameInput.value = jsonData.entries[0].name

  mapMarkers = jsonData.markers
  reloadMarker()

  globalCursor("initial") //loading done curser normal
})

//recieves and saves list of all world names
window.electronAPI.worldList((_event, names, files) => {
  worlds = names ? JSON.parse(names) : []
  worldFiles = files ? JSON.parse(files) : []

  console.log("recieved world list", worlds, worldFiles)

  loadWorldList()

  globalCursor("initial") //needet for inital loading
})

//shows homescreen and loads world list
function loadWorldList() {
  home.style.display = "grid"

  editor.isReady
      .then(() => {
        editor.clear()
      })
      .catch((reason) => {
        console.log(`Editor.js initialization failed because of ${reason}`)
      });

  if (worlds.length == 0) {
    // no worlds existing
    worldList.innerHTML =
      "<p class='empty' titel='enter world'>nothing here yet</p>"
  } else {
    let html = ""
    for (let i = 0; i < worlds.length; i++) {
      html += `<div onclick="globalCursor('wait'); window.electronAPI.selectWorld(${i})"><p class="text">${worlds[i]}</p><p class="delete" title="delete world">&#128473;</p></div>`
    }

    worldList.innerHTML = html
  }
}

function saveWorldName() {
  window.electronAPI.saveWorldName(worldname.value)
}

//template
function templateClientToServer() {
  window.electronAPI.clientToServer("good eveneing")
}

//#endregion

//---------- GENERAL ----------//
//#region

function changeMode(to) {
  let ps = document.querySelectorAll("nav ul li p")

  mode = to
  let elemWidth = ps[mode].clientWidth
  navMarker.style.width = `calc(${elemWidth}px + .8rem)`

  if (to == 0) {
    //to map
    navMarker.style.left = `calc(50% - ${navMarker.clientWidth}px - 1.5rem)`
    ps[1].style.color = "var(--nav-accent)"
    ps[0].style.color = "var(--text-background"
    map.style.left = 0
    wiki.style.left = "120%"
  } else if (to == 1) {
    //to wiki
    navMarker.style.left = "50%"
    ps[0].style.color = "var(--nav-accent)"
    ps[1].style.color = "var(--text-background)"
    wiki.style.left = 0
    map.style.left = "-120%"
  }
}

//switches between editing or viewing content
function toggelEditMode() {
  let ps = editModeToggel.querySelectorAll("p")
  let markerHTML = document.querySelectorAll(".marker")

  editor.readOnly.toggle()
  //TODO lock of inputs
  //TODO disabel buttons (add marker etc.)

  if (editmode == 1) {
    //view to edit
    editmode = 0
    ps[1].style.top = "100%"
    ps[0].style.top = 0

    markerHTML.forEach((elem) => {
      elem.classList.add("cursor-move")
    })

    swapEntry(currentEntry, true) //TODO automatically swaps to wiki on toggel

    /* document.body.classList.remove("viewing") */
  } else if (editmode == 0) {
    //edit to view
    editmode = 1
    ps[1].style.top = 0
    ps[0].style.top = "-100%"

    markerHTML.forEach((elem) => {
      elem.classList.remove("cursor-move")
    })

    document.body.classList.add("viewing")
  }
}

/**
 * called whenever user input happens
 */
function contentEdited() {
  if (contentSaved == true) {
    contentSaved = false
    //UNUSED save indicator
    /* saveInfo.innerText = "unsaved changes"
    saveInfo.style.color = "var(--text-background)" */

    document.querySelector("#save-button .save").style.display = "block"
    document.querySelector("#save-button .check").style.display = "none"

    window.electronAPI.setSaveStatus(0)
  }
}

function pxToVw(px) {
  let oneVW = window.innerWidth / 100
  return px / oneVW
}

function vwToPx(vw) {
  let oneVW = window.innerWidth / 100
  return vw * oneVW
}

//makes a overlay elem visible that disabels all interactions and shows a cursor
function globalCursor(cursor) {
  globalCursorElem.style.cursor = cursor
  if (cursor == "initial") {
    globalCursorElem.style.pointerEvents = "none"
  } else {
    globalCursorElem.style.pointerEvents = "auto"
  }
}

//shows adworld popup and if input is given sends worldname to server
function addWorld() {
  newWorld.querySelector(".button").innerText = "create"
  newWorld.querySelector(".button").style.top = "3rem"
  newWorld.querySelector(".close").style.opacity = 1
  newWorld.querySelector(".name").style.opacity = 1

  let newName = newWorldInput.value

  if (checkInputValue() === true) {
    //if input field has value
    console.log("WorldName: ", newName)

    window.electronAPI.addWorld(newName)

    closeAddWorldPopup()
  }
  else if (checkInputValue() != null) {
    newWorldInput.style.animation = "shake 0.5s"
    setTimeout(function () {
      newWorldInput.style.animation = ""
    }, 500)
  }
}

function checkInputValue() {
  let badChars = /.[^A-z _\-\.0-9]/ //all except [A-z _ - . 0-9 " "]
  let newName = newWorldInput.value

  if (newName == "" || newName == " ") {
    newWorld.querySelector("input").value = ""
    newWorldError.style.display = "none"

    console.log("empty")
    return null
  }

  for (let i = 0; i < worldFiles.length; i++) {
    //check for duplicate world names
    if (newName == worldFiles[i].slice(0, -5)) {
      newWorldError.innerText = "another world already exists with this name"
      newWorldError.style.display = "block"

      console.log("double")
      return false
    }
  }

  if (badChars.test(newName) == true) {
    //check if name contains invalid characters
    newWorldError.innerText =
      'name can only contain "a-Z", "0-9", ".", "-", "_"'
    newWorldError.style.display = "block"

    console.log("bad input")
    return false
  } else {
    newWorldError.innerText = "no error"
    newWorldError.style.display = "none"

    console.log("valid input")
    return true
  }
}

function closeAddWorldPopup() {
  newWorld.querySelector(".button").innerText = "new"
  newWorld.querySelector(".button").style.top = "0"
  newWorld.querySelector(".close").style.opacity = 0
  newWorld.querySelector(".name").style.opacity = 0
  newWorld.querySelector("input").value = ""
  newWorldError.display = "none"
}

function popup(type, data) {
  document.getElementById("popup").style.display = "block"

  if (type == 0) {
    //input
    document.querySelector("#popup .content").innerHTML = `
    <input type="text" placeholder="name">
    <div class="buttons">
        <p onclick='${data.submit}; closePopup()'>submit</p>
        <p onclick='closePopup()'>cancel</p>
    </div>`

    document.querySelector('#popup input').focus()
  }
  if (type == 1) {
    //confirm
    document.querySelector("#popup .content").innerHTML = `
    <p class="text">${data.text}</p>
    <div class="buttons">
      <p onclick='${data.confirm}; closePopup()'>confirm</p>
      <p onclick='closePopup()'>cancel</p>
    </div>`
  }
}

function closePopup() {
  document.getElementById("popup").style.display = "none"
}

function saveWorld() {
  if (mode == 1) {
    //mode is wiki
    swapEntry("save")
  }

  saveWorldName()
  saveMarkers()

  setTimeout(function () {
    //!REPLACE WITH PROMISE CALLS
    window.electronAPI.save() //tells server that all data has been sent
  }, 100)

  //UNUSED save indicator
  /* saveInfo.style.color = "var(--nav-accent)"
  saveInfo.innerText = "everything saved" */

  document.querySelector("#save-button .save").style.display = "none"
  document.querySelector("#save-button .check").style.display = "block"
  contentSaved = true
}

//#endregion

//---------- MAP ----------//
//#region
let mapZoom = 1

let startpos = { x: 0, y: 0, top: 0, left: 0 } //safes pos of cursor (x, y) and scroll in contianer (top, left)

function setMapZoom(value) {
  mapZoom = value / 10

  document.getElementById("zoom-value").innerText =
    Math.floor(mapZoom * 100) + "%" //displays zoom

  let safedSize = {
    //size of image before zoom change (image size change)
    height: parseFloat(mapImage.clientHeight),
    width: parseFloat(mapImage.clientWidth),
  }

  mapImage.style.width = 70 * mapZoom + "vw" ///changes image size (zoom in)

  //kinda lets you zoom into the center of the old view not the top corner
  //TODO improve centered zoom in
  mapContainer.scrollTop =
  parseFloat(mapContainer.scrollTop) +
  (parseFloat(mapImage.clientHeight) - safedSize.height) / 2
  mapContainer.scrollLeft =
  parseFloat(mapContainer.scrollLeft) +
  (parseFloat(mapImage.clientWidth) - safedSize.width) / 2
  
  //moves markers acording to new image size
  let markerHTML = mapContainer.querySelectorAll(".marker")
  for (let i = 0; i < mapMarkers.length; i++) {
    markerHTML[i].style.top = mapMarkers[i].top * mapZoom + "vw"
    markerHTML[i].style.left = mapMarkers[i].left * mapZoom + "vw"
  }
  
  if (mapZoom == 1 && mapImage.clientHeight < mapContainer.clientHeight) {
    mapContainer.style.cursor = "default"
  } //cursor reset if map is not zoomed in
  else mapContainer.style.cursor = "grab" //since image is zoomed in user should know its movable

  closeMarkerHover()
}

function mapMouseDown(e) {
  e = e || window.event

  if (mapZoom != 1 && e.target.closest("#map-image")) {
    //have nothing happen if zoom is 0 and user is clicking on the image
    console.log("starting drag map")

    e.preventDefault()

    // get the mouse cursor position at startup:
    startpos.x = e.clientX
    startpos.y = e.clientY
    startpos.top = mapContainer.scrollTop
    startpos.left = mapContainer.scrollLeft

    mapContainer.style.cursor = "grabbing"
    mapContainer.style.userSelect = "none"

    document.onmouseup = closeDragMap //stop dragging
    document.onmousemove = dragMap //move map

    function dragMap(e) {
      ///moves map with mouse
      mapContainer.scrollLeft = startpos.left - (e.clientX - startpos.x)
      mapContainer.scrollTop = startpos.top - (e.clientY - startpos.y)
    }

    function closeDragMap() {
      //stop moving when mouse button is released:
      document.onmouseup = null
      document.onmousemove = null

      if (mapZoom == 1) mapContainer.style.cursor = "default"
      //cursor reset if map is not zoomed in
      else mapContainer.style.cursor = "grab" //since image is zoomed in user should know its movable

      mapContainer.style.removeProperty("user-select")
    }
  }
}

//creates new map marker
function addMapMarker() {
  if(editmode == 0){ //editmode is edit
    mapMarkers.push({
      top: 20,
      left: 30,
      name: "new Marker",
      type: 0, //heading, label or pinpoint
      linksTo: null,
    })

    closeMarkerEdit()

    reloadMarker() //displays addet marker

    contentEdited()

    saveMarkers()
  }
}

//displays every marker in "mapMarkers" var
function reloadMarker() {
  let allMarkers = mapContainer.querySelectorAll(".marker")

  allMarkers.forEach((elem) => {
    //deletes all old markers (cant just overwrite html since its the same div as other important stuff)
    elem.remove()
  })

  for (let i = 0; i < mapMarkers.length; i++) {
    let newMarker = document.createElement("div")
    newMarker.classList.add("marker")
    if (editmode == 0) {
      newMarker.classList.add("cursor-move")
    } //only displayes move icon if "editmode" is set to edit
    newMarker.style.top = mapMarkers[i].top + "vw"
    newMarker.style.left = mapMarkers[i].left + "vw"
    newMarker.setAttribute("onmousedown", `moveMarker(this, ${i})`)
    newMarker.setAttribute("onmouseenter", `hoverMarker(this)`)
    newMarker.setAttribute("data-id", i)

    let markerIcon = document.createElement("div")
    markerIcon.classList.add("icon")

    //styles the different types of markers as they should
    switch (parseInt(mapMarkers[i].type)) {
      case 0:
        newMarker.classList.add("heading")
        break
      case 1:
        newMarker.classList.add("label")
        markerIcon.innerHTML = "&#9660;"
        break
      case 2:
        newMarker.classList.add("pinpoint")
        markerIcon.innerHTML = "&#9670;"
        break
    }

    //relativ elem to center markername propperly(no absolute relativ elem)
    let container = document.createElement("div")
    container.classList.add("relative")

    let markerName = document.createElement("p")
    markerName.innerText = mapMarkers[i].name

    container.appendChild(markerName)
    newMarker.appendChild(container)
    newMarker.appendChild(markerIcon)
    mapContainer.appendChild(newMarker)
  }
}

function clickMarker(id) {
  console.log("clicked marker", mapMarkers[id].linksTo)

  if(mapMarkers[id].linksTo != "null" && mapMarkers[id].linksTo != null){ //linksto is nothing
    swapEntry(mapMarkers[id].linksTo, true)
  }
}

let hoveredMarker = null

function hoverMarker(elem) {
  if (draggingMarker == false && editmode == 0) {
    //if user is not already moving marker and editmode is set to edit
    ///displayes edit symbol next to marker
    if (parseInt(mapMarkers[elem.dataset.id].type) == 0) {
      //marker type heading
      markerEditButton.style.top = parseFloat(elem.style.top) - 0.4 + "vw"
      markerEditButton.style.left =
        parseFloat(elem.style.left) -
        pxToVw(elem.querySelector("p").clientWidth / 2) -
        1 +
        "vw"
      markerEditButton.style.width =
        pxToVw(elem.querySelector("p").clientWidth) + 3 + "vw"
      markerEditButton.style.height =
        pxToVw(parseFloat(elem.querySelector("p").clientHeight)) + 1 + "vw"
      //? fix hover end in direction of text
    } else if (parseInt(mapMarkers[elem.dataset.id].type) == 1) {
      //marker type label
      markerEditButton.style.top = parseFloat(elem.style.top) - 0.3 + "vw"
      markerEditButton.style.left = parseFloat(elem.style.left) - 1 + "vw"
    } else {
      //marker type pinpoint
      markerEditButton.style.top = parseFloat(elem.style.top) - 0.5 + "vw"
      markerEditButton.style.left = parseFloat(elem.style.left) - 1 + "vw"
    }

    markerEditButton.style.display = "flex"

    hoveredMarker = elem ///saves marker that is currently hovered
  } else {
    closeMarkerHover()
  }
}

function closeMarkerHover() {
  markerEditButton.style.display = "none"
  markerEditButton.style.width = "3vw"
  markerEditButton.style.height = "4vh"
}

let editingMarker = null
let editing = false

function editMarker() {
  if (hoveredMarker == null) return //unlikely event that edit is called before marker was hovered

  if (editing == false) {
    //toggel
    editing = true
    editingMarker = hoveredMarker

    markerEditor.style.left = "-1rem" //shows marker editor

    let id = parseInt(editingMarker.dataset.id)

    //highlights marker that is beeing edited
    editingMarker.querySelector(".icon").style.color =
      "var(--marker-edit-color)"
    editingMarker.querySelector("p").style.textShadow =
      "var(--shadow-markers-edit)"

    //fills out input fields with data of selected marker
    markerEditor.querySelector(".marker-name").value = mapMarkers[id].name
    markerEditor.querySelector(".marker-type").value = mapMarkers[id].type
    markerEditor.querySelector(".marker-link").value = mapMarkers[id].linksTo
    
  } else {
    closeMarkerEdit()
  }
}

function saveMarkerEdits() {
  console.log("saving")
  let id = parseInt(editingMarker.dataset.id)

  mapMarkers[id].name = markerEditor.querySelector(".marker-name").value
  mapMarkers[id].type = markerEditor.querySelector(".marker-type").value
  mapMarkers[id].linksTo = markerEditor.querySelector(".marker-link").value

  saveMarkers() //sends markerdata to server

  closeMarkerEdit()

  reloadMarker() //displays changes
}

function closeMarkerEdit() {
  console.log("closing")
  editing = false

  //resets marker highlighting
  if(editingMarker != null){
    editingMarker.querySelector(".icon").style.color = "rgb(85, 72, 56)"
    editingMarker.querySelector("p").style.textShadow =
      "var(--shadow-markers-text), var(--shadow-markers-text), var(--shadow-markers-text)"
  }

  markerEditor.style.left = "-100%" //hides editor
}

function saveMarkers() {
  window.electronAPI.mapMarkers(JSON.stringify(mapMarkers))
}

function deleteMarker(elem) {
  let id = elem.getAttribute(`data-id`)
  popup(1, {
    text: 'Confirm deletion of selected marker',
    confirm:`mapMarkers.splice(${id}, 1); reloadMarker(); closeMarkerEdit(); contentEdited()`
  })
}

let draggingMarker = false
let dragStartTime = Date.now()

function moveMarker(elem, id, e) {
  e = e || window.event

  if (e.target.closest(".marker") != null ) {
    if(editmode == 0){
    //if user clicked marker and editmode is edit
    e.preventDefault()
    
    document.onmouseup = closeDragMarker
    document.onmousemove = dragMarker
    
    dragStartTime = Date.now() //saves time when user clicked

    // get the mouse cursor position at startup:
    startpos.x = e.clientX
    startpos.y = e.clientY
    startpos.top = vwToPx(parseFloat(elem.style.top))
    startpos.left = vwToPx(parseFloat(elem.style.left))


    draggingMarker = true
    closeMarkerHover()

    function dragMarker(e) {
      e = e || window.event
      e.preventDefault()

      mapMarkers[id].top = pxToVw(
        Math.min(
          //prevents marker moving out the bottom
          mapContainer.clientHeight - elem.clientHeight,
          Math.max(
            //prevents marker moving out the top
            elem.clientHeight,
            e.clientY - startpos.y + startpos.top
          )
        )
      )

      mapMarkers[id].left = pxToVw(
        Math.min(
          //prevents marker moving out the right
          mapContainer.clientWidth - elem.clientWidth / 2,
          Math.max(
            //prevents marker moving out the left
            elem.clientWidth / 2,
            e.clientX - startpos.x + startpos.left
          )
        )
      )

      elem.style.top = mapMarkers[id].top + "vw"
      elem.style.left = mapMarkers[id].left + "vw"

      contentEdited()
    }

    function closeDragMarker(e) {
      document.onmouseup = null
      document.onmousemove = null
      draggingMarker = false

      //if mouse was moved more than 6 pixel or held down for more than 300ms
      if (
        (Math.abs(startpos.x - e.clientX) > 6 &&
          Math.abs(startpos.y - e.clientY) > 6) ||
        Date.now() - dragStartTime > 300
      ) {
        ///hovering marker
        hoverMarker(elem)

        saveMarkers()
      } else {
        ///clicking marker
        //resets marker in case it was moved
        elem.style.top = pxToVw(startpos.top) + "vw"
        elem.style.left = pxToVw(startpos.left) + "vw"

        //rets stored marker pos acounting for zoom
        mapMarkers[id].top = pxToVw(startpos.top) / mapZoom
        mapMarkers[id].left = pxToVw(startpos.left) / mapZoom

        clickMarker(id)

        saveMarkers()
      }
    }
  }
  else{
    clickMarker(id)
  }
  }
}

function openFileUpload() {
  mapInput.click()
}

//reads selected image and converts to string
mapInput.addEventListener("change", function () {
  const reader = new FileReader()

  reader.addEventListener("load", () => {
    const uploadedImage = reader.result

    mapImage.style.backgroundImage = `url(${uploadedImage})`
    noMapImageButton.style.display = "none"
    mapImage.style.display = "block"
    mapControls.style.opacity = 1

    //reads size of string encodet image
    var i = new Image()
    i.onload = function () {
      mapImage.style.aspectRatio = i.width + " / " + i.height //making zooming or overflow cool or smth idk anymore
    }
    i.src = uploadedImage

    window.electronAPI.setMapImage(uploadedImage)
    contentEdited()
  })
  reader.readAsDataURL(this.files[0])
})
//#endregion

//---------- WIKI ----------//
//#region

function reloadWikiEntries() {
  let html = ""
  for (let i = 0; i < wikiEntries.length; i++) {
    html += `<li onclick="swapEntry('${wikiEntries[i].uuid}')">${wikiEntries[i].name}</li>`
  }
  asideContent.innerHTML = html
}

function addEntry() {
  popup(0, {
    submit:'window.electronAPI.addEntry(document.querySelector("#popup .content input").value); contentEdited()',
  })
}

function deleteEntry() {
  popup(1, {
    confirm:'window.electronAPI.deleteEntry(currentEntry); contentEdited()',
    text: 'Confirm deletion of this entry'
  })
}

function swapEntry(to, force) {
  if(to != currentEntry || to == "save" || force == true){ //must be new entry or call is from the save function or is forced since its called from a map marker
    changeMode(1)
    //gets data from editor
    editor
      .save()
      .then((outputData) => {
        if(currentEntry != undefined){
          console.log("saving wiki - entry data: ", outputData)

          window.electronAPI.saveEntry(JSON.stringify(outputData), entryNameInput.value, currentEntry)
        }
      })
      .then(() => {
        if(to != "save"){
          window.electronAPI.selectEntry(to)
        }
        else{
          console.log("save");
        }
      })
      .catch((error) => {
        console.error("Saving failed: ", error)
        alert("ERROR: saving failed: \n", error)
        contentSaved = false
      })
  }
}

function toggleAside() {
  if (asideVisible == false) {
    ///close -> open
    asideVisible = true
    openClose.style.transform = ""
    openClose.style.border = ".5rem solid transparent;"
    aside.querySelector(".content").style.display = "block"
    aside.querySelector("#add-entry").style.display = "block"
    aside.style.paddingRight = ".7rem"
  } else {
    ///open -> close
    asideVisible = false
    openClose.style.transform = "scaleX(1)"
    openClose.style.border = "1rem solid transparent;"
    aside.querySelector(".content").style.display = "none"
    aside.querySelector("#add-entry").style.display = "none"
    aside.style.paddingRight = "1rem"
  }
}

function updateEntryName(){
  wikiEntries.forEach(element => {
    if(element.uuid == currentEntry){
      element.name = entryNameInput.value
      reloadWikiEntries()
      return
    }
  });
}

function initEditor() {
  editor = new EditorJS({
    holder: `editjs`,
    tools: {
      header: Header,
      image: SimpleImage,
      /* linkTool: { //fetch error
        class: LinkTool,
        config: {
          endpoint: 'http://localhost:4000/fetchUrl', // Your backend endpoint for url data fetching,
        }
      }, */
      checklist: {
        class: Checklist,
        inlineToolbar: true,
      },
      MultiList: {
        class: NestedList,
        inlineToolbar: true,
      },
      underline: Underline,
      table: {
        class: Table,
        inlineToolbar: true,
        config: {
          rows: 2,
          cols: 3,
        },
      },
      quote: Quote,
    },
  })
}
//#endregion

//---------- KEY LISTENERS ----------//
//#region
let mDown = false
let wDown = false
let tDown = false

let ctrlDown = false

let enterDown = false
let escapeDown = false

let last = Date.now()

document.addEventListener("keydown", (e) => {
  if (e.key == "m") {
    mDown = true
  }
  if (e.key == "w") {
    wDown = true
  }
  if (e.key == "t") {
    tDown = true
  }

  if (e.key == "Enter") {
    enterDown = true
  }

  if (e.key == "Escape") {
    escapeDown = true
  }

  if (e.ctrlKey) {
    ctrlDown = true
  }
})

document.addEventListener("keyup", (e) => {
  if (e.key == "m") {
    mDown = false
  }
  if (e.key == "w") {
    wDown = false
  }
  if (e.key == "t") {
    tDown = false
  }

  if (e.key == "Enter") {
    enterDown = false
  }

  if (e.key == "Escape") {
    escapeDown = false
  }

  if (!e.ctrlKey) {
    ctrlDown = false
  }
})

///shortcuts
setInterval(() => {
  if (ctrlDown == true && mDown == true) {
    changeMode(0)
  }
  if (ctrlDown == true && wDown == true) {
    changeMode(1)
  }
  if (ctrlDown == true && tDown == true && Date.now() - last > 100) {
    last = Date.now()
    toggleAside()
  }

  if (editing == true) {
    //editing marker
    if (enterDown == true) {
      saveMarkerEdits()
      console.log("enterdown")
    } else if (escapeDown == true) {
      closeMarkerEdit()
      console.log("escapedown")
    }
  }
}, 100)

//#endregion
