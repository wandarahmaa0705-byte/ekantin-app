Set-Location $PSScriptRoot

$buildDir = Join-Path $PSScriptRoot 'www'
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

Get-ChildItem -Path $PSScriptRoot -File | Where-Object {
    $_.Name -notin @(
        'package-lock.json',
        'package.json',
        'server.js',
        'data',
        'uploads',
        'android',
        'node_modules',
        'capacitor.config.json',
        'capacitor.config.ts',
        'setup-capacitor.ps1'
    )
} | ForEach-Object {
    Copy-Item $_.FullName -Destination $buildDir -Force
}

Get-ChildItem -Path $PSScriptRoot -File -Include *.html, *.css, *.js, *.png, *.jpg, *.jpeg, *.webp, *.svg, *.ico | ForEach-Object {
    Copy-Item $_.FullName -Destination $buildDir -Force
}

Set-Content -Path (Join-Path $PSScriptRoot 'capacitor.config.json') -Value @'
{
  "appId": "com.ekantin.app",
  "appName": "eKantin",
  "webDir": "www",
  "bundledWebRuntime": false,
  "server": {
    "url": "http://192.168.110.23:3000",
    "androidScheme": "https",
    "cleartext": true,
    "allowNavigation": [
      "192.168.110.23:3000",
      "127.0.0.1:3000",
      "localhost:3000",
      "your-server-domain.com"
    ]
  }
}
'@ -Encoding utf8

npx cap sync android
