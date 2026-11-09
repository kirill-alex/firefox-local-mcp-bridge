$ErrorActionPreference = 'Stop'
if (Get-Process firefox -ErrorAction SilentlyContinue) {
    throw 'Firefox is already running. Save your work and close all Firefox windows before using this launcher.'
}
$firefoxCandidates = @(
    (Join-Path $env:ProgramFiles 'Mozilla Firefox/firefox.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Mozilla Firefox/firefox.exe')
)
$firefoxPath = $firefoxCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (!$firefoxPath) { throw 'Firefox executable was not found.' }
Start-Process -FilePath $firefoxPath -ArgumentList @('--remote-debugging-port', '9222') -WindowStyle Normal
Write-Output 'Firefox started with local WebDriver BiDi on port 9222.'
