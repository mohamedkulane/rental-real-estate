export function isAggregatePortfolioView(section: string, view: string) {
  if (section === 'owners') return view === 'owned-properties' || view === 'documents';
  if (section === 'properties') return view !== 'overview';
  if (section === 'spaces') return view !== 'overview';
  return false;
}

export function shouldLoadParentPortfolioList(section: string, view: string) {
  return !isAggregatePortfolioView(section, view);
}
