const {app, BrowserWindow, dialog, ipcMain} = require("electron"),
    path = require("path"),
    fs = require("fs"),
    {exec} = require('child_process'),
    ffmpeg = require('ffmpeg-static'),
    ffprobe = require('ffprobe-static').path,
    readline = require('readline');


function createWindow() {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 400,
        webPreferences: {
            contextIsolation: false, worldSafeExecuteJavaScript: true,
            nodeIntegration: true
        }
    });

    mainWindow.loadFile("index.html");
}

// ffmpeg -i input -filter:a "atempo=1.5" -vn output.mp3
function changeSpeed(input, output, speed) {
    let runCommand = `"${ffmpeg}" -i "${input}" -filter:a "atempo=${speed}" -vn "${output}"`;
    return runCommand;
}

function formatDuration(input) {
    if (input === '0:00:0') {
        return '0:00:00';
    }
    let inputArray = input.split(':');
    let seconds = Number(inputArray[inputArray.length - 1]);
    seconds = seconds.toFixed(0);
    if (seconds < 10) {
        seconds = '0' + seconds;
    }
    inputArray[inputArray.length - 1] = String(seconds);
    output = inputArray.join(":");
    return output;
}

 // ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 -sexagesimal input.mp4
function getDuration(input) {
    let runCommand = `"${ffprobe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 -sexagesimal "${input}"`;
    return runCommand;
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
})

ipcMain.on("choose-file", () => {
    dialog.showOpenDialog( {
        properties: ['openfile'],
        filters: [{
            name: 'Audio',
            extensions: ['mp3', 'm4a']
        }]
    }).then(result => {
        if (!result.canceled) {
            const filePath = result.filePaths[0];
            const fileName = path.basename(filePath);

            exec(getDuration(filePath), (err, stdout) => {
                if (err) {
                    console.error(err);
                    process.exit(1);
                }
                else {
                    if(mainWindow instanceof BrowserWindow){
                        mainWindow.webContents.send('duration', {
                            'duration': formatDuration(stdout),
                            'fileName': fileName,
                            'filePath': filePath
                        });
                    }
                }
            });
        }

        else {
            if (mainWindow instanceof BrowserWindow){
                mainWindow.webContents.send("clear-filename");
            }
        }
    })
    .catch(err => console.log(err));
});

ipcMain.on("submit", (e, args) => {
    const [filePath, speed] = args,
        extension = path.extname(filePath),
        filename = path.basename(filePath, extension) + "_sped.mp3",
        cwd = path.dirname(filePath),
        output = path.join(cwd, filename);

    if (fs.existsSync(output)) {
        console.log("deleting existing converted file first...");
        fs.unlinkSync(output);
    }

    console.log("Input file: " + path.basename(filePath));
    console.log("Speed: " + speed);
    console.log("Output file: ", filename, '\n');
    console.log('starting conversion...');

    const execCommand = exec(changeSpeed(filePath, output, speed));
    const rl = readline.createInterface({
        input: execCommand.stderr,
        crlfDelay: Infinity
    });
   
    rl.on('line', text => {
        if (text.startsWith('size=')) {
            var outputDuration = text.slice(22,32);
            process.stdout.write(`Output Duration: ${outputDuration}\r`);
            if(mainWindow instanceof BrowserWindow)
                mainWindow.webContents.send('completed', formatDuration(outputDuration));
        }
    });

    execCommand.on('close', () => {
        const newLineString = (process.platform === 'win32') ? '\n' : '\n';
        process.stdout.write(newLineString);
        console.log('done with conversion!')
        
    })
});


app.on('window-all-closed', () => {
    if (process.platform !== "darwin") app.quit()
});