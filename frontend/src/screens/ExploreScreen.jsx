import { useMemo } from 'react'
import { useCampusData } from '../features/locations/CampusDataProvider.jsx'
import { HomePanel } from '../features/home/HomePanel.jsx'
import { useMapLayout, useMapView } from '../layout/mapLayoutContext.js'
import { layout } from '../design/tokens.js'
import { useIsPhone } from '../hooks/useMediaQuery.js'

/** Home: browse / search / filter campus places over the map. */
export default function ExploreScreen() {
  const { status, error, reload, getById } = useCampusData()
  const { discovery, origin } = useMapLayout()
  const peekHeight = useIsPhone() ? layout.phoneSheetPeek : layout.mobileSheetPeek

  useMapView({ visibleIds: discovery.visibleIds, peekHeight, label: 'Places' })

  const group = useMemo(
    () => (discovery.groupIds ? discovery.groupIds.map(getById).filter(Boolean) : null),
    [discovery.groupIds, getById],
  )

  return (
    <HomePanel status={status} error={error} onRetry={reload} discovery={discovery} group={group} origin={origin} />
  )
}
