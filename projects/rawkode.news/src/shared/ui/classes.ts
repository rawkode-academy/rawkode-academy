export const interactiveControlClass =
  "outline-none transition-[background-color,color,border-color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-ring/60";

export const interactiveTextClass =
  "outline-none transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-ring/60";

export const interactiveTextActionClass =
  "outline-none transition-[color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-ring/60";

export const inputClass =
  "h-[var(--rkn-control-md-height)] w-full min-w-0 rounded-none border border-input bg-card px-[var(--rkn-control-inline-padding)] text-sm text-foreground outline-none placeholder:text-muted-foreground/90 transition-[border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:border-primary/70 focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";

export const textareaClass =
  "w-full rounded-none border border-input bg-card px-[var(--rkn-control-inline-padding)] py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/90 transition-[border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:border-primary/70 focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";

export const buttonPrimarySmClass =
  `inline-flex h-[var(--rkn-control-sm-height)] items-center justify-center gap-1.5 whitespace-nowrap rounded-none border border-transparent bg-primary px-[var(--rkn-control-inline-padding)] text-[0.83rem] font-medium text-primary-foreground ${interactiveControlClass} hover:bg-primary/94 disabled:pointer-events-none disabled:opacity-45`;

export const buttonSecondarySmClass =
  `inline-flex h-[var(--rkn-control-sm-height)] items-center justify-center gap-1.5 whitespace-nowrap rounded-none border border-transparent bg-secondary px-[var(--rkn-control-inline-padding)] text-[0.83rem] font-medium text-secondary-foreground ${interactiveControlClass} hover:bg-secondary/84 disabled:pointer-events-none disabled:opacity-45`;

export const buttonDestructiveSmClass =
  `inline-flex h-[var(--rkn-control-sm-height)] items-center justify-center gap-1.5 whitespace-nowrap rounded-none border border-transparent bg-destructive px-[var(--rkn-control-inline-padding)] text-[0.83rem] font-medium text-destructive-foreground ${interactiveControlClass} hover:bg-destructive/92 disabled:pointer-events-none disabled:opacity-45`;

export const buttonPrimaryMdClass =
  `inline-flex h-[var(--rkn-control-md-height)] items-center justify-center gap-2 whitespace-nowrap rounded-none border border-transparent bg-primary px-[calc(var(--rkn-control-inline-padding)+0.25rem)] py-2 text-sm font-medium text-primary-foreground ${interactiveControlClass} hover:bg-primary/94 disabled:pointer-events-none disabled:opacity-45`;

export const buttonPrimaryLgClass =
  `inline-flex h-[var(--rkn-control-lg-height)] items-center justify-center gap-2 whitespace-nowrap rounded-none border border-transparent bg-primary px-[calc(var(--rkn-control-inline-padding)+0.8rem)] text-[0.95rem] font-medium text-primary-foreground ${interactiveControlClass} hover:bg-primary/94 disabled:pointer-events-none disabled:opacity-45`;

export const buttonGhostSmClass =
  `inline-flex h-[var(--rkn-control-sm-height)] items-center justify-center rounded-none px-[var(--rkn-control-inline-padding)] text-[0.83rem] font-medium text-muted-foreground ${interactiveControlClass} hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-45`;

export const paginationControlClass =
  `inline-flex h-[var(--rkn-control-sm-height)] items-center rounded-none px-[var(--rkn-control-inline-padding)] text-[0.83rem] font-medium ${interactiveControlClass}`;

export const menuPanelItemClass =
  `block rounded-none px-3 py-2 text-foreground/80 ${interactiveControlClass} hover:bg-accent hover:text-foreground`;

export const shellNavItemSmClass =
  `inline-flex h-[var(--rkn-control-sm-height)] items-center rounded-none px-[var(--rkn-control-inline-padding)] text-sm font-medium text-muted-foreground ${interactiveControlClass} hover:bg-accent hover:text-foreground`;

export const shellNavStrongItemSmClass =
  `inline-flex h-[var(--rkn-control-sm-height)] items-center rounded-none px-[var(--rkn-control-inline-padding)] text-sm font-medium ${interactiveControlClass}`;

export const textLinkMutedXsClass =
  `text-xs text-muted-foreground ${interactiveTextClass} hover:text-foreground`;

export const textActionMutedXsClass =
  `text-xs font-medium text-muted-foreground ${interactiveTextActionClass} hover:text-foreground`;

export const textActionMutedXsUnderlineClass =
  `inline-flex items-center text-xs font-medium text-muted-foreground underline-offset-4 ${interactiveTextClass} hover:text-foreground hover:underline`;

export const tagChipBaseClass =
  "inline-flex h-[var(--rkn-control-sm-height)] max-w-full min-w-0 items-center gap-1 border px-[var(--rkn-control-inline-padding)] text-xs font-medium";

export const tagFilterChipClass =
  `${tagChipBaseClass} rounded-full border-border text-muted-foreground ${interactiveControlClass} hover:bg-muted hover:text-foreground`;

export const tagFilterChipSelectedClass =
  `${tagChipBaseClass} rounded-full border-primary/40 bg-primary/10 text-foreground`;

export const tagRemovalControlClass =
  `inline-flex h-6 w-6 min-h-6 min-w-6 items-center justify-center rounded-full text-sm leading-none text-muted-foreground ${interactiveTextClass} hover:text-foreground`;

export const selectPrimarySmClass =
  `h-[var(--rkn-control-sm-height)] w-full min-w-0 cursor-pointer appearance-none rounded-md border border-primary/40 bg-primary/10 text-center text-xs font-medium text-foreground outline-none [text-align-last:center] ${interactiveControlClass} hover:bg-primary/14`;

export const checkboxPillSmClass =
  `inline-flex h-[var(--rkn-control-sm-height)] w-full min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground ${interactiveControlClass} hover:bg-muted hover:text-foreground has-[:checked]:border-primary/34 has-[:checked]:bg-primary/8 has-[:checked]:text-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/60`;

export const inlineBackLinkSmClass =
  `inline-flex h-9 items-center justify-center rounded-none px-3 text-[0.83rem] font-medium text-muted-foreground ${interactiveControlClass} hover:bg-accent hover:text-foreground`;

export const inlinePrimaryLinkClass =
  "inline-flex items-center gap-1.5 text-sm font-medium text-primary outline-none transition-[color,text-decoration-color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:underline focus-visible:ring-2 focus-visible:ring-ring/60";
