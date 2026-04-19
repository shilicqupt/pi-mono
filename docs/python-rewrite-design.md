# pi-mono Python 重写设计文档（分阶段执行）

## 1. 目标与范围

### 1.1 总体目标

将 `pi-mono` 从 TypeScript/Node.js 单体仓库，重写为 Python 单体仓库，在功能、行为、交互体验上尽量保持一致，同时保证可持续迭代。

### 1.2 设计原则

1. **行为等价优先**：先实现与现有行为一致，再做 Python 风格优化。
2. **增量迁移**：按模块逐步替换，不做一次性“全量切换”。
3. **可回归验证**：每个阶段都必须有自动化对照测试与验收标准。
4. **边界清晰**：将协议层、业务层、UI 层解耦，降低迁移风险。

### 1.3 非目标（当前阶段）

- 不在第一阶段追求性能极限优化。
- 不做大规模功能重设计。
- 不在未完成一致性验证前移除 TypeScript 参考实现。

## 2. 现状与目标形态

### 2.1 现状（高层）

当前仓库为多包结构（`packages/*`），关键能力包含：

- AI 提供方抽象与流式事件协议
- coding-agent（CLI + TUI 交互）
- 相关工具、配置与模型选择机制

### 2.2 目标 Python 形态（建议）

建议建立 Python monorepo（或单包多模块）结构：

```text
py-pi-mono/
  pyproject.toml
  src/
    pi_ai/
    pi_agent/
    pi_tui/
    pi_core/
    pi_tools/
  tests/
    contract/
    integration/
    e2e/
  scripts/
  docs/
```

## 3. 迁移策略

### 3.1 三轨并行

1. **契约轨（Contract First）**
   - 先冻结 TypeScript 侧可观察行为（输入输出、事件序列、错误语义）。
2. **实现轨（Python Port）**
   - 按优先级迁移核心模块，保留接口兼容层。
3. **验证轨（Diff & Replay）**
   - 对同一输入进行 TS/Python 双跑，对比输出与事件流。

### 3.2 迁移优先级

P0（先做）
- 核心类型系统与事件模型
- Provider 抽象 + 至少 1 个主 Provider
- 会话与消息编排

P1（第二阶段）
- CLI 运行模式
- 配置系统与 model resolver

P2（第三阶段）
- TUI 交互层（组件与键位）
- 扩展能力与边缘功能

## 4. 架构设计

### 4.1 分层

- **Domain 层**：消息、工具调用、token 用量、停止原因等核心模型
- **Application 层**：对话编排、模型路由、上下文压缩策略
- **Infra 层**：Provider SDK、文件系统、进程执行、网络请求
- **Interface 层**：CLI/TUI/API 入口

### 4.2 关键接口（Python）

```python
class AssistantEvent(TypedDict):
    type: Literal["text", "tool_call", "thinking", "usage", "stop", "error"]
    ...

class Provider(Protocol):
    async def stream(self, options: StreamOptions) -> AsyncIterator[AssistantEvent]:
        ...
```

说明：以上只是接口草案，后续在 `pi_ai/types.py` 固化并与 TS 契约对齐。

### 4.3 并发与流式

- 全面采用 `asyncio`。
- Provider 流式输出统一为 `AsyncIterator[event]`。
- 工具调用执行器采用可取消任务模型（`asyncio.Task` + 超时/取消语义）。

## 5. 模块映射（TS -> Python）

### 5.1 packages/ai -> src/pi_ai

迁移内容：
- provider 注册/发现
- stream 与 streamSimple 语义
- 消息转换与事件标准化

### 5.2 packages/coding-agent -> src/pi_agent + src/pi_tui

迁移内容：
- 参数解析（CLI）
- model resolver
- 交互式会话流程
- TUI 组件能力（首期可先做最小可用版本）

### 5.3 公共工具 -> src/pi_core / src/pi_tools

迁移内容：
- 配置加载
- 路径与文件工具
- 子进程与 sandbox 封装

## 6. 测试与一致性验证

### 6.1 测试分层

1. **契约测试**：事件序列、停止原因、错误映射
2. **集成测试**：provider + agent 的端到端子流程
3. **回放测试**：基于 TS 录制用例回放到 Python
4. **金丝雀测试**：关键用户路径 smoke

### 6.2 对照策略

- 建立 `fixtures/transcripts/*.jsonl`，记录 TS 基线输出。
- Python 执行同样输入，按规则进行字段级 diff。
- 允许差异：时间戳、非语义排序、provider 原始 metadata。

## 7. 逐步执行计划（里程碑）

## M0：仓库与基线准备（1 周）

交付物：
- Python 工程骨架（`pyproject.toml`、lint、format、type-check）
- 契约文档 v1（事件类型、错误码、配置 schema）
- TS 行为基线采集脚本

验收标准：
- 可运行 `python -m pi_agent --help`
- 生成首批基线样本（>= 20 条）

## M1：AI 核心迁移（2~3 周）

交付物：
- `pi_ai` 基础类型与 provider 接口
- 1 个主 provider 的流式实现
- usage、stop、tool_call 事件对齐

验收标准：
- 契约测试通过率 >= 95%
- 关键路径回放误差可解释并文档化

## M2：Agent 编排迁移（2 周）

交付物：
- model resolver
- session 管理
- tool execution 管线

验收标准：
- 典型 coding-agent 场景（命令执行、文件修改建议）可运行

## M3：CLI 完整化（1~2 周）

交付物：
- 参数系统
- 配置优先级与环境变量支持
- 非交互模式输出一致化

验收标准：
- CLI 对齐测试通过

## M4：TUI 迁移（3~4 周）

交付物：
- 最小 TUI（消息流、输入、滚动、状态栏）
- 键位配置系统（可配置，不写死）

验收标准：
- 交互回归脚本通过
- 核心 UX 行为与 TS 版本一致

## M5：切换与收尾（1 周）

交付物：
- 发布文档
- 迁移指南
- TS 参考实现降级为 compatibility/reference

验收标准：
- 新实现作为默认入口
- 回滚策略可验证

## 8. 风险与应对

1. **Provider 行为细节差异**
   - 应对：增加 provider-specific golden tests；必要时加适配层。
2. **TUI 生态差异（Ink -> Python TUI 库）**
   - 应对：先保语义，后保像素级表现；组件能力分期实现。
3. **并发取消语义不一致**
   - 应对：统一取消协议，构建中断场景专项测试。
4. **开发节奏受双栈维护拖累**
   - 应对：定义阶段性“冻结点”，避免 TS/Python 同时大改。

## 9. 推荐技术栈（Python）

- Python 3.12+
- 打包：`uv` + `pyproject.toml`
- 类型检查：`pyright` 或 `mypy`
- 测试：`pytest` + `pytest-asyncio`
- CLI：`typer`（或 `argparse`）
- TUI：`textual`（优先）或 `prompt_toolkit`
- HTTP：`httpx`

## 10. 本仓库下一步执行清单（立即可做）

1. 在仓库新增 `docs/python-rewrite-design.md`（本文件）。
2. 创建 `python/` 或 `src/` 初始骨架（仅脚手架，不替换现有逻辑）。
3. 编写 TS 基线采集脚本与首批 fixtures。
4. 落地 M0 验收脚本（CI 可运行）。
5. M0 通过后再进入 M1 的 provider 迁移。

---

## 决策记录（ADR）约定

从 M0 开始，为关键决策建立 ADR：

- `docs/adr/0001-python-runtime-and-packaging.md`
- `docs/adr/0002-event-contract-and-compatibility.md`
- `docs/adr/0003-tui-framework-selection.md`

每个 ADR 至少包含：背景、备选方案、决策、影响、回滚方案。
