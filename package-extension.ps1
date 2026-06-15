# package-extension.ps1
# Zips the chrome-extension folder for Web Store submission or local sharing

$sourceDir = Join-Path $PSScriptRoot "chrome-extension"
$destinationZip = Join-Path $PSScriptRoot "styla-measure-extension.zip"

if (Test-Path $destinationZip) {
    Remove-Item $destinationZip -Force
}

Write-Host "Packaging Chrome Extension from $sourceDir..."
Compress-Archive -Path "$sourceDir\*" -DestinationPath $destinationZip -Force
Write-Host "Success: Packaged extension into styla-measure-extension.zip!"
