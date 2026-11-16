# markdown-fast-renderer

[![bounty](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02)
[![rank](https://make.fun/badge/adam017/markdown-fast-renderer/rank.svg)](https://make.fun/badge/adam017/markdown-fast-renderer/rank.svg)
[![reward](https://make.fun/badge/adam017/markdown-fast-renderer/reward.svg)](https://make.fun/badge/adam017/markdown-fast-renderer/reward.svg)

A from-scratch Markdown to HTML converter that matches the CommonMark and GFM
reference output byte for byte, built as a single dependency-free ES module so
it can be imported directly by the grading driver.

The lexer walks the document line by line, keeping a stack of open containers so
that blockquotes, list items and fenced code compose the way the spec requires.
Inline content is parsed once per paragraph with a delimiter stack for emphasis,
which keeps the whole thing allocation-light and fast on large documents.
