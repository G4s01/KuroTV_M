import { useWindowDimensions } from 'react-native';

export interface CardDimensionsOptions {
  paddingHorizontal?: number;
  gap?: number;
  minCardWidth?: number;
  maxColumns?: number;
}

export interface ResponsiveLayout {
  width: number;
  height: number;
  isTablet: boolean;
  isLandscape: boolean;
  railWidth: number;
  contentWidth: number;
  numColumns: number;
  cardWidth: number;
  cardHeight: number;
  isMasterDetail: boolean;
  leftMasterWidth: number;
  rightDetailWidth: number;
  episodeColumns: number;
  portraitEpisodeColumns: number;
  getCardDimensions: (options?: CardDimensionsOptions) => {
    numColumns: number;
    cardWidth: number;
    cardHeight: number;
  };
}

/**
 * Pure calculation function for responsive layout (Android sw600dp standard)
 */
export function computeResponsiveLayout(width: number, height: number): ResponsiveLayout {
  // True tablet / foldable qualification (Android sw600dp equivalent)
  // Ensures standard phones rotated in landscape remain in phone layout.
  const isTablet = Math.min(width, height) >= 600;
  const isLandscape = width > height;

  const railWidth = isTablet ? 76 : 0;
  const contentWidth = Math.max(0, width - railWidth);

  const getCardDimensions = (options?: CardDimensionsOptions) => {
    const padding = options?.paddingHorizontal ?? 16;
    const gap = options?.gap ?? 12;
    const minWidth = options?.minCardWidth ?? 165;
    const maxCols = options?.maxColumns ?? (isTablet ? (isLandscape ? 6 : 4) : 2);

    let cols = 2;
    if (isTablet) {
      cols = Math.max(3, Math.min(maxCols, Math.floor(contentWidth / minWidth)));
    }

    const totalPadding = padding * 2;
    const totalGaps = gap * (cols - 1);
    const cardW = Math.floor((contentWidth - totalPadding - totalGaps) / cols);
    const cardH = Math.floor(cardW * 1.45);

    return {
      numColumns: cols,
      cardWidth: cardW,
      cardHeight: cardH,
    };
  };

  const defaultCards = getCardDimensions();

  // Master-Detail sizing for AnimeDetailScreen on tablets:
  // Active ONLY when tablet is in landscape orientation.
  // In portrait on tablet, AnimeDetailScreen remains unified (single-column)
  // as requested ("Con schermo verticale la scheda dettagli della serie si divide a metà (preferibile di no)").
  const isMasterDetail = isTablet && isLandscape;

  // Master-Detail left column (poster, title, badges, action buttons, info table)
  // Stack screen has full width (no rail)
  const leftMasterWidth = isMasterDetail
    ? Math.min(420, Math.max(340, Math.floor(width * 0.35)))
    : width;
  const rightDetailWidth = isMasterDetail
    ? Math.max(0, width - leftMasterWidth - 1)
    : width;

  // Master-Detail right column episode grid columns
  const episodeColumns = isMasterDetail
    ? Math.max(4, Math.min(8, Math.floor(rightDetailWidth / 80)))
    : 4;

  // Portrait layout episode grid columns (phone = 4, tablet portrait = 5-8 columns)
  const portraitEpisodeColumns = isTablet
    ? Math.max(5, Math.min(8, Math.floor((Math.min(width, 960) - 24) / 80)))
    : 4;

  return {
    width,
    height,
    isTablet,
    isLandscape,
    railWidth,
    contentWidth,
    numColumns: defaultCards.numColumns,
    cardWidth: defaultCards.cardWidth,
    cardHeight: defaultCards.cardHeight,
    isMasterDetail,
    leftMasterWidth,
    rightDetailWidth,
    episodeColumns,
    portraitEpisodeColumns,
    getCardDimensions,
  };
}

/**
 * Responsive layout hook for Kuro Mobile / Tablet
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  return computeResponsiveLayout(width, height);
}
