# 批量替换QQ相关中文文本
$replacements = @(
    @("发布动态到QQ空间", "发布动态到动态空间"),
    @("编辑已发布的QQ空间动态", "编辑已发布的动态空间动态"),
    @("删除已发布的QQ空间动态", "删除已发布的动态空间动态"),
    @("发QQ空间", "发动态空间"),
    @("QQ空间", "动态空间"),
    @("QQ 空间", "动态空间"),
    @("QQ号", "用户ID"),
    @("仿 QQ", "即时通讯"),
    @("仿QQ", "即时通讯"),
    @("QQ 风格", "即时通讯风格"),
    @("该QQ号已被注册", "该用户ID已被注册"),
    @("检查QQ号是否已存在", "检查用户ID是否已存在"),
    @("QQ number already exists", "用户ID already exists"),
    @("QQ already taken", "用户ID already taken")
)

$testReplacements = @(
    @("QQ 10001", "用户ID 10001"),
    @("QQ 10002", "用户ID 10002"),
    @("QQ 10003", "用户ID 10003"),
    @("QQ 10004", "用户ID 10004"),
    @("QQ 99999", "用户ID 99999")
)

$root = "E:\Agent_Projects\projects"
$extensions = @("*.ts", "*.tsx", "*.css", "*.md")
$files = @()

foreach ($ext in $extensions) {
    $files += Get-ChildItem -Path $root -Recurse -Filter $ext -ErrorAction SilentlyContinue | Where-Object {
        $_.FullName -notmatch "node_modules|\\.next|\\archive|dist"
    }
}

$processed = 0
$changedFiles = @()

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content
    
    foreach ($r in $replacements) {
        $content = $content.Replace($r[0], $r[1])
    }
    
    foreach ($r in $testReplacements) {
        $content = $content.Replace($r[0], $r[1])
    }
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        $changedFiles += $file.FullName.Replace($root, "")
        $processed++
    }
}

Write-Host "Changed files: $processed"
foreach ($f in $changedFiles) {
    Write-Host "  $f"
}
