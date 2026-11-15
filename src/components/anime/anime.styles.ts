import { StyleSheet } from 'react-native';
import { oledTheme } from '@/theme';

export const animeDetailStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topNav: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navRight: {
    flexDirection: 'row',
    gap: 8,
  },
  navIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  headerWrapper: {
    backgroundColor: '#000000',
  },
  listContentContainer: {
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    color: oledTheme.colors.textMuted,
    fontSize: 13,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  errorTitle: {
    color: oledTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  retryBtn: {
    backgroundColor: oledTheme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: oledTheme.radius.full,
    marginTop: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  masterDetailContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  leftMasterColumn: {
    height: '100%',
  },
  leftMasterScrollContent: {
    paddingHorizontal: 16,
  },
  masterDetailDivider: {
    width: 1,
    height: '100%',
  },
  rightDetailColumn: {
    flex: 1,
    height: '100%',
  },
  rightDetailHeader: {
    paddingHorizontal: 16,
  },
  rightDetailListContent: {
    paddingHorizontal: 12,
  },
  tabletCenteredContainer: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
});
