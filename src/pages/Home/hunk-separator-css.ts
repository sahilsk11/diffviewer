export const hunkSeparatorCSS = `
  [data-separator=line-info] {
    height: 32px;
    margin-block: 0;
    background: var(--diffs-bg);
  }

  [data-separator=line-info][data-separator-first] {
    margin-top: 0;
  }

  [data-separator=line-info][data-separator-last] {
    margin-bottom: 0;
  }

  [data-separator=line-info] [data-separator-wrapper] {
    min-width: 0;
    padding-inline: 0;
    background: transparent;
  }

  [data-separator=line-info][data-expand-index] [data-separator-wrapper] {
    grid-template-columns: 3.25rem max-content;
  }

  [data-separator=line-info] [data-expand-button],
  [data-separator=line-info] [data-separator-content] {
    background: transparent;
    border: 0;
  }

  [data-separator=line-info] [data-expand-button] {
    min-width: 3.25rem;
    color: #a1a1aa;
    border-radius: 0;
  }

  [data-separator=line-info] [data-expand-button]:hover {
    color: #d4d4d8;
    background: transparent;
  }

  [data-separator=line-info] [data-separator-content] {
    gap: 8px;
    color: #a1a1aa;
    border-radius: 0;
    font-size: 13px;
    font-weight: 400;
    justify-content: flex-start;
    letter-spacing: 0;
    min-width: max-content;
    padding-inline: 0;
    overflow: visible;
  }

  [data-separator=line-info] [data-separator-content]:hover {
    background: transparent;
    text-decoration: none;
  }

  [data-separator=line-info] [data-unmodified-lines] {
    color: #a1a1aa;
    text-decoration: none;
    overflow: visible;
  }

  [data-separator=line-info] [data-separator-content]::after {
    color: #a1a1aa;
    content: "\\2022  expand all";
    flex: 0 0 auto;
    font-weight: 400;
  }

  [data-separator=line-info] [data-icon] {
    width: 13px;
    height: 13px;
  }
`;
