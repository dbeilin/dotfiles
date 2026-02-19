if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# ---------- Environment ----------
export ZDOTDIR=${HOME}
export EDITOR=vim
export HISTFILE=~/.zsh_history
export HISTSIZE=10000
export SAVEHIST=10000

# ---------- History & Behavior ----------
setopt HIST_IGNORE_ALL_DUPS HIST_IGNORE_SPACE SHARE_HISTORY INC_APPEND_HISTORY
setopt AUTO_CD AUTO_PUSHD PUSHD_IGNORE_DUPS
setopt INTERACTIVE_COMMENTS NO_BEEP
setopt appendhistory sharehistory hist_ignore_space hist_ignore_all_dups
setopt hist_save_no_dups hist_ignore_dups hist_find_no_dups

# ---------- Homebrew (macOS / Linux) ----------
if [[ -d /opt/homebrew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif command -v brew >/dev/null 2>&1; then
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi

# ---------- Custom Functions ----------
fpath=(~/.zsh/functions $fpath)
autoload -Uz awsctx

# ---------- Completions ----------
autoload -Uz compinit
ZCOMPDUMP=${XDG_CACHE_HOME:-$HOME/.cache}/zsh/zcompdump-${ZSH_VERSION}
mkdir -p ${ZCOMPDUMP:h}
compinit -d "$ZCOMPDUMP" -C

# Completion UI prefs
zmodload zsh/complist
setopt COMPLETE_IN_WORD AUTO_MENU
zstyle ':completion:*' menu select
zstyle ':completion:*' rehash true
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'
bindkey -e

# Carapace completions
# export CARAPACE_BRIDGES='zsh,bash,inshellisense'
# zstyle ':completion:*' format $'\e[2;37mCompleting %d\e[m'
# source <(carapace _carapace)

# ---------- Antidote (Lazy Loading) ----------
# Lazy-load antidote and generate the static load file only when needed
zsh_plugins=${ZDOTDIR:-$HOME}/.zsh_plugins
if [[ ! ${zsh_plugins}.zsh -nt ${zsh_plugins}.txt ]]; then
  (
    if [[ ! -d ${ZDOTDIR:-$HOME}/.antidote ]]; then
      git clone --depth=1 https://github.com/mattmc3/antidote.git ${ZDOTDIR:-$HOME}/.antidote
    fi
    
    source ${ZDOTDIR:-$HOME}/.antidote/antidote.zsh
    zstyle ':antidote:bundle' use-friendly-names on
    zstyle ':antidote:static' zcompile yes
    antidote bundle <${zsh_plugins}.txt >${zsh_plugins}.zsh
  )
fi
source ${zsh_plugins}.zsh

# ---------- Prompt (Powerlevel10k) ----------
[[ -r ~/.p10k.zsh ]] && source ~/.p10k.zsh

# ---------- Aliases / PATH ----------
[[ -f ~/.zsh_aliases ]] && source ~/.zsh_aliases

# ---------- Shell Integrations ----------
eval "$(atuin init zsh --disable-up-arrow)"
eval "$(zoxide init --cmd cd zsh)"
eval "$(fnm env --use-on-cd --shell zsh)"

[[ "$TERM_PROGRAM" == "vscode" ]] && . "$(code --locate-shell-integration-path zsh)"
export PROMPT_EOL_MARK=""
export LESS='-R'
