$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

try {
  chcp 65001 | Out-Null
} catch {
  # Some hosted terminals do not expose chcp. The .NET encoding settings above still help.
}

$PSDefaultParameterValues['Get-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Set-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Add-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$PSDefaultParameterValues['Export-Csv:Encoding'] = 'utf8'

Write-Host 'UTF-8 terminal settings applied for this PowerShell session.'
Write-Host 'Tip: dot-source this file to affect the current shell: . .\scripts\use-utf8-terminal.ps1'
