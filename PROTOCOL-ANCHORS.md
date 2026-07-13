# 协议域 · 四个锚点文件（路径备忘）

下列文件由 **archo evo/** 子模块提供，**不要**在本仓库根目录重复造同名协议正文；升级协议请改子模块指针或向 archo-evo 提交。

| 序号 | 文件 | 路径 | 说明 |
|------|------|------|------|
| 1 | README | archo evo/README.md | 协作流程、分支、闭环 |
| 2 | SPEC | archo evo/SPEC.md | 协议域北极星与成熟标准 |
| 3 | INDEX | archo evo/INDEX.md | **提案**索引（与 proposals/ 双向一致） |
| 4 | DISCUSSION_INDEX | archo evo/DISCUSSION_INDEX.md | **讨论稿**索引（与 discussions/ 链接） |

自检脚本 archo-check.py 将 **README / SPEC / INDEX** 列为关键存在性检查项；**DISCUSSION_INDEX** 若存在则校验其中链接可达。
