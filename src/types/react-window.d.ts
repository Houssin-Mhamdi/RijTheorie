declare module "react-window" {
  import { Component, CSSProperties, ComponentType } from "react"

  export interface ListChildComponentProps {
    index: number
    style: CSSProperties
    data: any
    isScrolling?: boolean
  }

  export interface ListProps {
    children: ComponentType<ListChildComponentProps>
    className?: string
    height: number | string
    itemCount: number
    itemSize: number
    width: number | string
    overscanCount?: number
    initialScrollOffset?: number
    onItemsRendered?: (props: {
      overscanStartIndex: number
      overscanStopIndex: number
      visibleStartIndex: number
      visibleStopIndex: number
    }) => void
    style?: CSSProperties
    itemData?: any
    useIsScrolling?: boolean
  }

  export class List extends Component<ListProps> {
    scrollToItem(index: number, align?: string): void
  }

  export { List as FixedSizeList }
}
