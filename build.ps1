# build.ps1 - Compiles the app using a local C: directory to bypass Google Drive sync locks
$ProjectDir = $PSScriptRoot
if (-not $ProjectDir) { $ProjectDir = Get-Location }
$BuildDir = "C:\Users\Bonica\wine-tasting-app-build"
$NodePortable = Resolve-Path "$ProjectDir\..\node-portable"

# Add portable Node.js to path so npm sub-processes and scripts can execute successfully
$env:PATH = "$NodePortable;$env:PATH"

Write-Host "=========================================" -ForegroundColor Yellow
Write-Host "   Wine Tasting Web App Compilation" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Yellow

Write-Host "1. Creating local build folder at $BuildDir..." -ForegroundColor Cyan
if (Test-Path $BuildDir) {
    Remove-Item $BuildDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null

Write-Host "2. Copying project files..." -ForegroundColor Cyan
Copy-Item -Path "$ProjectDir\src" -Destination "$BuildDir\src" -Recurse -Force
Copy-Item -Path "$ProjectDir\package.json" -Destination "$BuildDir\package.json" -Force
Copy-Item -Path "$ProjectDir\vite.config.ts" -Destination "$BuildDir\vite.config.ts" -Force
Copy-Item -Path "$ProjectDir\tsconfig.json" -Destination "$BuildDir\tsconfig.json" -Force
Copy-Item -Path "$ProjectDir\postcss.config.js" -Destination "$BuildDir\postcss.config.js" -Force
Copy-Item -Path "$ProjectDir\tailwind.config.js" -Destination "$BuildDir\tailwind.config.js" -Force
Copy-Item -Path "$ProjectDir\index.html" -Destination "$BuildDir\index.html" -Force

Write-Host "3. Installing dependencies in local build folder..." -ForegroundColor Cyan
Push-Location $BuildDir
& "$NodePortable\npm.cmd" install --no-audit --no-fund

Write-Host "4. Compiling web application..." -ForegroundColor Cyan
& "$NodePortable\npm.cmd" run build

Pop-Location

Write-Host "5. Copying compiled distribution files back to Google Drive..." -ForegroundColor Cyan
if (Test-Path "$ProjectDir\dist") {
    Remove-Item "$ProjectDir\dist" -Recurse -Force -ErrorAction SilentlyContinue
}
Copy-Item -Path "$BuildDir\dist" -Destination "$ProjectDir\dist" -Recurse -Force

Write-Host "6. Cleaning up local build folder..." -ForegroundColor Cyan
Remove-Item $BuildDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "-----------------------------------------" -ForegroundColor Green
Write-Host "SUCCESS: Build complete! Compiled static site files are in:" -ForegroundColor Green
Write-Host "$ProjectDir\dist" -ForegroundColor White
Write-Host "You can open index.html inside the dist folder or host it on Vercel/GitHub Pages." -ForegroundColor Gray
Write-Host "=========================================" -ForegroundColor Green
