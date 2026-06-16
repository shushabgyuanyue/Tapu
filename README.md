# <项目名称>

> 将标题中的 <项目名称> 改成你的仓库名。

本仓库使用协议仓库 **rcho-evo** 作为 **rcho evo/** Git 子模块（协作协议与工作流）。

## 克隆

`ash
git clone --recurse-submodules <本仓库 URL>
`

若未带子模块：git submodule update --init --recursive。

## 必读：协议域四个锚点文件（已由子模块提供）

python archo-check.py 自检要求协议根目录存在 **README.md / SPEC.md / INDEX.md**；另有讨论索引 **DISCUSSION_INDEX.md**（与提案 INDEX.md 分工不同）。均已随子模块就位：

| 文件 | 路径 |
|------|------|
| 协作协议正文 | [rcho evo/README.md](archo%20evo/README.md) |
| 协议北极星 SPEC | [rcho evo/SPEC.md](archo%20evo/SPEC.md) |
| 提案 INDEX | [rcho evo/INDEX.md](archo%20evo/INDEX.md) |
| 讨论稿索引 | [rcho evo/DISCUSSION_INDEX.md](archo%20evo/DISCUSSION_INDEX.md) |

修改协议内容请在 **rcho evo/** 仓库内按提案流程进行；详见上表 README。

## 项目域四个锚点文件（根目录占位模板，待你填写）

与本产品相关的北极星、域分工、文档地图与阶段验收见根目录 **SPEC.md**、**DOMAINS.md**、**DOCUMENT_INDEX.md**、**develop.md**（脚手架已生成初稿，搜索 待填写 替换）。

## 协议自检

`ash
python "archo evo/archo-check.py"
`

（独立新项目若无 Archo 主仓 git 对象，merge_commit 等可能出现告警，属预期；与 Archo 主仓联合开发时可在主仓根目录执行以关联历史。）

## 更多

- 项目文档入口：docs/README.md
- 协议入口清单（可复制）：[PROTOCOL-ANCHORS.md](PROTOCOL-ANCHORS.md)