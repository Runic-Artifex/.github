param(
    [Parameter(Mandatory)][string]$Version,
    [Parameter(Mandatory)][string]$ArtifactDirectory,
    [Parameter(Mandatory)][string]$RepositoryUrl,
    [Parameter(Mandatory)][string]$RepositoryCommit,
    [Parameter(Mandatory)][int]$ExpectedCount
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($Version -notmatch '^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$') {
    throw "'$Version' is not a SemVer-compatible package version."
}
if ($RepositoryCommit -notmatch '^[0-9a-fA-F]{40}$') {
    throw "Repository commit must be a full Git commit."
}

$directory = (Resolve-Path -LiteralPath $ArtifactDirectory).Path
$packages = @(Get-ChildItem -LiteralPath $directory -Filter '*.nupkg' -File |
    Where-Object { -not $_.Name.EndsWith('.snupkg', [StringComparison]::OrdinalIgnoreCase) } |
    Sort-Object Name)
if ($packages.Count -ne $ExpectedCount) {
    throw "Expected $ExpectedCount NuGet packages, found $($packages.Count)."
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$packageIds = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

foreach ($package in $packages) {
    $archive = [System.IO.Compression.ZipFile]::OpenRead($package.FullName)
    try {
        $nuspecEntries = @($archive.Entries | Where-Object { $_.FullName.EndsWith('.nuspec', [StringComparison]::OrdinalIgnoreCase) })
        if ($nuspecEntries.Count -ne 1) {
            throw "$($package.Name) must contain exactly one nuspec."
        }

        $reader = [System.IO.StreamReader]::new($nuspecEntries[0].Open())
        try {
            [xml]$document = $reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
        }

        $metadata = $document.SelectSingleNode("//*[local-name()='metadata']")
        if ($null -eq $metadata) {
            throw "$($package.Name) does not contain package metadata."
        }

        $read = {
            param([string]$Name)
            $node = $metadata.SelectSingleNode("*[local-name()='$Name']")
            if ($null -eq $node) { return '' }
            return $node.InnerText.Trim()
        }

        $id = & $read 'id'
        $packageVersion = & $read 'version'
        $authors = & $read 'authors'
        $description = & $read 'description'
        $projectUrl = & $read 'projectUrl'
        $readme = & $read 'readme'
        $tags = & $read 'tags'
        $license = $metadata.SelectSingleNode("*[local-name()='license']")
        $repository = $metadata.SelectSingleNode("*[local-name()='repository']")

        if ($id -notmatch '^[A-Za-z0-9_.-]+$' -or -not $packageIds.Add($id)) {
            throw "$($package.Name) has an invalid or duplicate package id '$id'."
        }
        if ($packageVersion -ne $Version) {
            throw "$id has version '$packageVersion'; expected '$Version'."
        }
        if ([string]::IsNullOrWhiteSpace($authors)) {
            throw "$id must declare authors."
        }
        if ($description.Length -lt 20) {
            throw "$id must provide a meaningful description."
        }
        if ($null -eq $license -or $license.GetAttribute('type') -ne 'expression' -or $license.InnerText.Trim() -ne 'MIT') {
            throw "$id must use the MIT license expression."
        }
        if ($projectUrl.TrimEnd('/') -ne $RepositoryUrl.TrimEnd('/')) {
            throw "$id has project URL '$projectUrl'; expected '$RepositoryUrl'."
        }
        if ($null -eq $repository -or $repository.GetAttribute('type') -ne 'git' -or
            $repository.GetAttribute('url').TrimEnd('/') -ne $RepositoryUrl.TrimEnd('/') -or
            $repository.GetAttribute('commit') -ne $RepositoryCommit) {
            throw "$id does not identify the expected Git repository and commit."
        }
        if ([string]::IsNullOrWhiteSpace($tags)) {
            throw "$id must declare package tags."
        }
        if ([string]::IsNullOrWhiteSpace($readme)) {
            throw "$id must declare a package README."
        }
        $readmeEntry = @($archive.Entries | Where-Object { $_.FullName -eq $readme })
        if ($readmeEntry.Count -ne 1) {
            throw "$id declares README '$readme' but does not package it exactly once."
        }
    }
    finally {
        $archive.Dispose()
    }
}

Write-Output "Validated $ExpectedCount public NuGet artifacts for $Version."
