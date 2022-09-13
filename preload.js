const { contextBridge, ipcRenderer } = require("electron")

/* const customTitlebar = require("custom-electron-titlebar") */

contextBridge.exposeInMainWorld("electronAPI", {
  //server to client
  requestSaveData: (callback) => ipcRenderer.on("request-save-data", callback),
  wikiEntry: (callback) => ipcRenderer.on("wiki-entry", callback),
  world: (callback) => ipcRenderer.on("world", callback),
  worldList: (callback) => ipcRenderer.on("world-list", callback),
  wikiEntryList: (callback) => ipcRenderer.on("wiki-entry-list", callback),

  //client to server
  save: () => ipcRenderer.send("save"),
  saveEntry: (data, name, id) => ipcRenderer.send("save-entry", data, name, id),
  addEntry: (data, name) => ipcRenderer.send("add-entry", data, name),
  deleteEntry: (data, uuid) => ipcRenderer.send("delete-entry", data, uuid),
  selectEntry: (id) => ipcRenderer.send("select-entry", id),
  selectWorld: (id) => ipcRenderer.send("select-world", id),
  saveWorldName: (name) => ipcRenderer.send("save-world-name", name),
  setMapImage: (map) => ipcRenderer.send("set-map-image", map),
  mapMarkers: (data) => ipcRenderer.send("map-markers", data),
  setSaveStatus: (value) => ipcRenderer.send("set-save-status", value),
  addWorld: (value) => ipcRenderer.send("add-world", value),
  loadHome: (value) => ipcRenderer.send("load-home", value),
  clientToServer: (value) => ipcRenderer.send("client-to-server", value),
})

console.log("this is the preload speaking")

window.addEventListener("DOMContentLoaded", () => {
  /* let MyTitleBar = new customTitlebar.Titlebar({
        backgroundColor: customTitlebar.Color.fromHex('#03a9f4')
    });

    MyTitleBar.updateTitle('WorldManager'); */
})

ipcRenderer.on("world-list", (_event) => {
  console.log("world list at preload")
})

ipcRenderer.on("wik-entry", (_event, value) => {
  console.log("wiki entry at preload")
})
