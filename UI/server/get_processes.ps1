# Get per-process memory usage in MB
$procs = Get-Process | Select-Object Name, Id, @{Name="RAM_MB";Expression={[math]::Round($_.WorkingSet64 / 1MB,2)}}
$procs | ConvertTo-Json -Depth 2
