. "$PSScriptRoot\use-utf8-terminal.ps1"

$sample = [string]::Concat(
  [char]0x4e2d,
  [char]0x6587,
  ' / WhatMint / UTF-8'
)

Write-Host ''
Write-Host 'Terminal encoding diagnostics:'
Write-Host "  Console input:  $([Console]::InputEncoding.WebName)"
Write-Host "  Console output: $([Console]::OutputEncoding.WebName)"
Write-Host "  OutputEncoding: $($OutputEncoding.WebName)"
Write-Host "  Sample text:    $sample"
Write-Host ''
Write-Host 'If the sample text is readable, terminal display is healthy.'
Write-Host 'If files still look broken, run Get-Content -Encoding UTF8 <path> or dot-source use-utf8-terminal.ps1.'
