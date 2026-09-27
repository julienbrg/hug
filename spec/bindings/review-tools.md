# Review tools

This document lists tools a maintainer can review and approve chunks with in [HuG Flow](../hug-flow.md). It is informative. P3 needs one thing from the tool: it shows the unstaged diff and stages individual hunks, or lines, into the approval surface. The IDE doesn't matter otherwise.

## Git

| Kind      | Tools                                                                                                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editors   | [VS Code](https://code.visualstudio.com/) and its forks, such as Cursor; [JetBrains](https://www.jetbrains.com/) IDEs; [Visual Studio](https://visualstudio.microsoft.com/); [Zed](https://zed.dev/) |
| Terminal  | [Neovim](https://neovim.io/) with [fugitive](https://github.com/tpope/vim-fugitive) or [gitsigns](https://github.com/lewis6991/gitsigns.nvim); Emacs with [Magit](https://magit.vc/)                 |
| Git UIs   | [lazygit](https://github.com/jesseduffield/lazygit), [tig](https://jonas.github.io/tig/), [Sublime Merge](https://www.sublimemerge.com/), `git gui`                                                  |
| Git alone | `git add -p`                                                                                                                                                                                         |

An editor that cannot stage hunks, such as Notepad++, still works for reading the diff: the maintainer then stages from one of the other tools, or with `git add -p`.

## Jujutsu

`jj squash -i` opens Jujutsu's built-in diff editor to pick hunks, or the one set in `ui.diff-editor`, such as [Meld](https://meldmerge.org/). See the [VCS bindings](vcs.md#jujutsu).
