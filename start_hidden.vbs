Set WshShell = CreateObject("WScript.Shell")

' Get the directory of the current script
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath

' Run 'npm run dev' in the background (0 = hide window, false = do not wait for completion)
WshShell.Run "cmd.exe /c npm run dev", 0, false

' Wait 3 seconds for the server to start
WScript.Sleep 3000

' Open the web browser to the local server
WshShell.Run "cmd.exe /c start http://localhost:5173", 0, false
