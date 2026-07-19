[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^v?\d+\.\d+\.\d+$')]
    [string]$Version,

    [ValidateNotNullOrEmpty()]
    [string]$Remote = 'origin',

    [ValidatePattern('^[a-z0-9][a-z0-9._/-]*$')]
    [string]$ImageName = 'meteor-history',

    [switch]$SkipDockerBuild
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$originalLocation = Get-Location
$versionNumber = $Version.TrimStart('v')
$tagName = "v$versionNumber"
$createdCommit = $false
$versionFilesModified = $false

function Assert-LastExitCode {
    param([Parameter(Mandatory = $true)][string]$Operation)
    if ($LASTEXITCODE -ne 0) {
        throw "$Operation failed with exit code $LASTEXITCODE."
    }
}

function Assert-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

try {
    Set-Location $projectRoot

    Assert-Command git
    Assert-Command npm
    if (-not $SkipDockerBuild) {
        Assert-Command docker
    }

    git rev-parse --is-inside-work-tree | Out-Null
    Assert-LastExitCode 'Git repository check'

    $branchName = (git branch --show-current).Trim()
    Assert-LastExitCode 'Current branch lookup'
    if (-not $branchName) {
        throw 'Releases cannot be created from a detached HEAD.'
    }

    git remote get-url $Remote | Out-Null
    Assert-LastExitCode "Remote '$Remote' lookup"

    $status = git status --porcelain
    Assert-LastExitCode 'Working tree check'
    if ($status) {
        throw 'The working tree must be clean before creating a release.'
    }

    git fetch $Remote --tags
    Assert-LastExitCode 'Remote tag refresh'

    git rev-parse --verify --quiet "refs/tags/$tagName" | Out-Null
    if ($LASTEXITCODE -eq 0) {
        throw "Tag '$tagName' already exists."
    }

    Write-Host "Preparing Meteor History $tagName"

    npm ci
    Assert-LastExitCode 'Dependency installation'

    npm version $versionNumber --no-git-tag-version
    Assert-LastExitCode 'Package version update'
    $versionFilesModified = $true

    npm run check
    Assert-LastExitCode 'Project checks'

    if (-not $SkipDockerBuild) {
        docker build --pull --build-arg "APP_VERSION=$versionNumber" --build-arg "SOURCE_URL=https://github.com/MengMengCode/meteor-history" --tag "${ImageName}:$versionNumber" --tag "${ImageName}:latest" .
        Assert-LastExitCode 'Docker image build'
    }

    git add -- package.json package-lock.json
    Assert-LastExitCode 'Release file staging'

    git commit -m "release: $tagName"
    Assert-LastExitCode 'Release commit'
    $createdCommit = $true

    git tag --annotate $tagName --message "Meteor History $tagName"
    Assert-LastExitCode 'Release tag creation'

    git push --atomic $Remote "HEAD:refs/heads/$branchName" "refs/tags/$tagName"
    Assert-LastExitCode 'Atomic release push'

    Write-Host "Release tag $tagName was pushed successfully."
    Write-Host 'GitHub Actions will publish the multi-platform GHCR image and GitHub Release.'
    if (-not $SkipDockerBuild) {
        Write-Host "Local images: ${ImageName}:$versionNumber and ${ImageName}:latest"
    }
}
catch {
    if ($versionFilesModified -and -not $createdCommit) {
        git restore -- package.json package-lock.json 2>$null
    }
    Write-Error $_
    exit 1
}
finally {
    Set-Location $originalLocation
}
