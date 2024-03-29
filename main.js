//
const electron = require ('electron');
const { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, shell } = electron;
//
let mainWindow = null;
//
const gotTheLock = app.requestSingleInstanceLock ();
if (!gotTheLock)
{
    app.quit ();
}
else
{
    app.on
    (
        'second-instance',
        (event, commandLine, workingDirectory) =>
        {
            if (mainWindow)
            {
                if (mainWindow.isMinimized ())
                {
                    mainWindow.restore ();
                }
                mainWindow.focus ();
            }
        }
    );
    //
    // Share settings with the renderer process
    global.settings = require ('./settings.json');
    //
    if (!settings.accelerated)
    {
        app.disableHardwareAcceleration ();
    }
    //
    const fs = require ('fs');
    const os = require ('os');
    const path = require ('path');
    const url = require ('url');
    //
    const isPackaged = !process.defaultApp;
    //
    const appName = app.getName ();
    const appVersion = app.getVersion ();
    const appDate = (isPackaged ? fs.statSync (app.getPath ('exe')).birthtime : new Date ()).toISOString ();
    //
    let appDirname = app.getAppPath ();
    let unpackedDirname = `${appDirname}.unpacked`;
    if (!fs.existsSync (unpackedDirname))
    {
        unpackedDirname = appDirname;
    };
    //
    function showAboutBox (menuItem, browserWindow, event)
    {
        let options =
        {
            type: 'info',
            message: `${appName}`,
            detail: `${settings.description}\n${settings.copyright}\n\nVersion: ${appVersion}\nDate: ${appDate}`,
            buttons: [ "OK" ]
        };
        dialog.showMessageBox ((process.platform === 'darwin') ? null : browserWindow, options);
    }
    //
    let licenseWindow = null;
    //
    function showLicense (menuItem, browserWindow, event)
    {
        if (!licenseWindow)
        {
            licenseWindow = new BrowserWindow
            (
                {
                    title: `License | ${appName}`,
                    width: 384,
                    height: (process.platform !== 'darwin') ? 480 : 540,
                    parent: browserWindow,
                    minimizable: false,
                    maximizable: false,
                    resizable: false,
                    fullscreenable: false,
                    show: false
                }
            );
            if (process.platform !== 'darwin')
            {
                licenseWindow.setMenu (new Menu ()); // Partial workaround for Electron 4.x.x or 5.x.x on Linux
                licenseWindow.removeMenu ();
            }
            licenseWindow.loadFile ('license.html');
            licenseWindow.once ('ready-to-show', () => { licenseWindow.show (); });
            licenseWindow.on ('close', () => { licenseWindow = null; });
        }
        else
        {
            licenseWindow.focus ();
        }
    }
    //
    function copySystemInfo ()
    {
        const infos =
        [
            "-- Application --",
            "",
            [ "Name", appName ],
            [ "Version", appVersion ],
            [ "Date", appDate ],
            "",
            [ "Locale", app.getLocale () ],
            [ "Packaged", app.isPackaged ],
            "",
            "-- Framework --",
            "",
            [ "Platform", process.platform ],
            [ "Architecture", process.arch ],
            [ "Default App", process.defaultApp || false ],
            [ "Mac App Store App", process.mas || false ],
            [ "Windows Store App", process.windowsStore || false ],
            [ "Electron Version", process.versions.electron ],
            [ "Node Version", process.versions.node ],
            [ "V8 Version", process.versions.v8 ],
            [ "Chromium Version", process.versions.chrome ],
            [ "ICU Version", process.versions.icu ],
            [ "Unicode Version", process.versions.unicode ],
            // [ "CLDR Version", process.versions.cldr ],
            // [ "Time Zone Version", process.versions.tz ],
            "",
            "-- Operating System --",
            "",
            [ "OS Type", os.type () ],
            [ "OS Platform", os.platform () ],
            [ "OS Release", os.release () ],
            [ "CPU Architecture", os.arch () ],
            [ "CPU Endianness", os.endianness () ],
            [ "CPU Logical Cores", os.cpus ().length ],
            [ "CPU Model", os.cpus ()[0].model ],
            [ "CPU Speed (MHz)", os.cpus ()[0].speed ]
        ];
        let systemInfo = infos.map (info => (Array.isArray (info) ? `${info[0]}: ${info[1]}` : info) + "\n").join ("");
        clipboard.writeText (systemInfo);
    }
    //
    let defaultWidth;
    let defaultHeight;
    //
    function resetWindow ()
    {
        if (mainWindow.isFullScreen ())
        {
            shell.beep ();
        }
        else
        {
            if (mainWindow.isMaximized ())
            {
                mainWindow.unmaximize ();
            }
            mainWindow.setSize (defaultWidth, defaultHeight);
            mainWindow.center ();
            if (mainWindow.isMinimized ())
            {
                mainWindow.restore ();
            }
        }
    }
    //
    const darwinAppMenu =
    {
        label: appName,
        submenu:
        [
            { label: `About ${appName}...`, click: showAboutBox },
            { type: 'separator' },
            { role: 'services', submenu: [ ] },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideothers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
        ]
    };
    const appMenu =
    {
        label: settings.shortAppName,
        submenu:
        [
            { role: 'quit' }
        ]
    };
    const editMenu =
    {
        label: "Edit",
        submenu:
        [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'delete' },
            { type: 'separator' },
            { role: 'selectall' }
        ]
    };
    const viewMenu =
    {
        label: "View",
        submenu:
        [
            { label: "Toggle Navigation Sidebar", accelerator: 'CommandOrControl+N', click: () => { mainWindow.webContents.send ('toggle-sidebar'); } },
            { label: "Toggle Categories", accelerator: 'CommandOrControl+K', click: () => { mainWindow.webContents.send ('toggle-categories'); } },
            { type: 'separator' },
            { label: "Scroll to Top", accelerator: 'CommandOrControl+T', click: () => { mainWindow.webContents.send ('scroll-to-top'); } },
            { label: "Scroll to Bottom", accelerator: 'CommandOrControl+B', click: () => { mainWindow.webContents.send ('scroll-to-bottom'); } },
            { type: 'separator' },
            { role: 'resetzoom' },
            { role: 'zoomin' },
            { role: 'zoomout' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    };
    const developerMenu =
    {
        label: "Developer",
        submenu:
        [
            { role: 'reload' },
            { role: 'toggledevtools' },
            { type: 'separator' },
            { label: "Open User Data Directory", click: () => { shell.openItem (app.getPath ('userData')); } },
            { label: "Open Temporary Directory", click: () => { shell.openItem (app.getPath ('temp')); } },
            { type: 'separator' },
            { label: "Show Executable File", click: () => { shell.showItemInFolder (app.getPath ('exe')); } },
            { type: 'separator' },
            { label: "Copy System Info to Clipboard", click: copySystemInfo }
        ]
    };
    const darwinWindowMenu =
    {
        role: 'window',
        submenu:
        [
            { role: 'close' },
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { label: "Reset to Default", accelerator: 'CommandOrControl+D', click: () => { resetWindow (); } },
            { type: 'separator' },
            { role: 'front' }
        ]
    };
    const windowMenu =
    {
        label: "Window",
        submenu:
        [
            { role: 'minimize' },
            { role: 'close' },
            { type: 'separator' },
            { label: "Reset to Default", accelerator: 'CommandOrControl+D', click: () => { resetWindow (); } }
         ]
    };
    const darwinHelpMenu =
    {
        role: 'help',
        submenu:
        [
            { label: "License...", click: showLicense },
            { label: settings.repository.label, click: () => { shell.openExternal (settings.repository.URL); } },
            { label: settings.releases.label, click: () => { shell.openExternal (settings.releases.URL); } }
        ]
    };
    const helpMenu =
    {
        label: 'Help',
        submenu:
        [
            { label: "About...", click: showAboutBox },
            { type: 'separator' },
            { label: "License...", click: showLicense },
            { label: settings.repository.label, click: () => { shell.openExternal (settings.repository.URL); } },
            { label: settings.releases.label, click: () => { shell.openExternal (settings.releases.URL); } }
        ]
    };
    //
    let menuTemplate = [ ];
    menuTemplate.push ((process.platform === 'darwin') ? darwinAppMenu : appMenu);
    menuTemplate.push (editMenu);
    menuTemplate.push (viewMenu);
    if (settings.unitsMenu)
    {
        menuTemplate.push ({ label: settings.unitsName.replace (/&/g, "&&"), submenu: [ ] });
    }
    if ((!isPackaged) || settings.developerFeatures)
    {
        menuTemplate.push (developerMenu);
    }
    menuTemplate.push ((process.platform === 'darwin') ? darwinWindowMenu : windowMenu);
    menuTemplate.push ((process.platform === 'darwin') ? darwinHelpMenu : helpMenu);
    //
    let menu;
    //
    function updateUnitsMenu (unitNames, currentUnitName)
    {
        for (let menuTemplateItem of menuTemplate)
        {
            if (menuTemplateItem["label"] === settings.unitsName.replace (/&/g, "&&"))
            {
                menuTemplateItem["submenu"] = [ ];
                for (let unitName of unitNames)
                {
                    menuTemplateItem["submenu"].push
                    (
                        {
                            label: unitName.replace (/&/g, "&&"),
                            type: 'radio',
                            checked: (unitName === currentUnitName),
                            click: () => { mainWindow.webContents.send ('select-unit', unitName); },
                        }
                    );
                }
                menu = Menu.buildFromTemplate (menuTemplate);
                Menu.setApplicationMenu (menu);
                break;
            }
        }
    }
    //
    function syncUnitsMenu (unitName)
    {
        for (let menuItem of menu.items)
        {
            if (menuItem.label === settings.unitsName.replace (/&/g, "&&"))
            {
                let submenu = menuItem.submenu;
                for (let submenuItem of submenu.items)
                {
                    if (submenuItem.label === unitName.replace (/&/g, "&&"))
                    {
                        submenuItem.checked = true;
                    }
                }
            }
        }
    }
    //
    function onAppReady ()
    {
        if (!settings.unitsMenu)
        {
            menu = Menu.buildFromTemplate (menuTemplate);
            Menu.setApplicationMenu (menu);
        }
        //
        const Storage = require ('./lib/storage.js');
        const mainStorage = new Storage ('main-preferences');
        //
        const { screen } = electron;
        let workAreaWidth = screen.getPrimaryDisplay ().workArea.width;
        let workAreaHeight = screen.getPrimaryDisplay ().workArea.height;
        //
        defaultWidth = settings.window.largerDefaultWidth;
        defaultHeight = settings.window.largerDefaultHeight;
        if ((defaultWidth > workAreaWidth) || (defaultHeight > workAreaHeight))
        {
            defaultWidth = settings.window.defaultWidth;
            defaultHeight = settings.window.defaultHeight;
        }
        //
        const defaultPrefs =
        {
            windowBounds:
            {
                width: defaultWidth,
                height: defaultHeight
            }
        };
        let prefs = mainStorage.get (defaultPrefs);
        let windowBounds = prefs.windowBounds;
        //
        mainWindow = new BrowserWindow
        (
            {
                icon: (process.platform === 'linux') && path.join (__dirname, 'icons', 'icon-256.png'),
                center: true,
                x: windowBounds.x,
                y: windowBounds.y,
                width: windowBounds.width,
                height: windowBounds.height,
                minWidth: settings.window.minWidth,
                minHeight: settings.window.minHeight,
                backgroundColor: settings.window.backgroundColor,
                show: !settings.window.deferredShow,
                webPreferences:
                {
                    nodeIntegration: true
                }
            }
        );
        //
        mainWindow.loadURL (url.format ({ protocol: 'file', slashes: true, pathname: path.join (__dirname, 'renderer', 'index.html') }));
        //
        mainWindow.webContents.on ('will-navigate', (event) => { event.preventDefault (); }); // Inhibit drag-and-drop of URL on window
        //
        mainWindow.once ('close', () => { mainStorage.set ({ windowBounds: mainWindow.getBounds () }); });
        //
        mainWindow.once ('closed', () => { if (process.platform === 'darwin') { app.hide (); } app.quit (); });
        //
        if (settings.unitsMenu)
        {
            ipcMain.on
            (
                'update-units-menu',
                (event, unitNames, currentUnitName) =>
                {
                    updateUnitsMenu (unitNames, currentUnitName);
                }
            );
            ipcMain.on ('sync-units-menu', (event, unitName) => { syncUnitsMenu (unitName); });
        }
        //
        ipcMain.on ('show-window', () => { mainWindow.show (); });
        //
        if (settings.escapeExitsFullScreen)
        {
            ipcMain.on
            (
                'exit-full-screen',
                () =>
                {
                    if (mainWindow.isFullScreen ())
                    {
                        mainWindow.setFullScreen (false);
                    }
                    else
                    {
                        // shell.beep ();
                    }
                }
            );
        }
        //
        if (settings.hotKey)
        {
            // Set hot key
            globalShortcut.register (settings.hotKey, () => { mainWindow.show (); });
        }
    }
    //
    app.once ('ready', onAppReady);
}
//
