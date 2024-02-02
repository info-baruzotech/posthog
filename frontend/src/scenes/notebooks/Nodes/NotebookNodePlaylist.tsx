import { createPostHogWidgetNode } from 'scenes/notebooks/Nodes/NodeWrapper'
import { FilterType, NotebookNodeType, RecordingFilters } from '~/types'
import {
    SessionRecordingPlaylistLogicProps,
    getDefaultFilters,
    sessionRecordingsPlaylistLogic,
} from 'scenes/session-recordings/playlist/sessionRecordingsPlaylistLogic'
import { BuiltLogic, useActions, useValues } from 'kea'
import { useEffect, useMemo, useState } from 'react'
import { urls } from 'scenes/urls'
import { notebookNodeLogic } from './notebookNodeLogic'
import { JSONContent, NotebookNodeProps, NotebookNodeAttributeProperties } from '../Notebook/utils'
import {
    SessionRecordingsFilterMode,
    SessionRecordingsFilters,
} from 'scenes/session-recordings/filters/SessionRecordingsFilters'
import { ErrorBoundary } from '@sentry/react'
import { SessionRecordingsPlaylist } from 'scenes/session-recordings/playlist/SessionRecordingsPlaylist'
import { sessionRecordingPlayerLogic } from 'scenes/session-recordings/player/sessionRecordingPlayerLogic'
import { IconComment } from 'lib/lemon-ui/icons'
import { sessionRecordingPlayerLogicType } from 'scenes/session-recordings/player/sessionRecordingPlayerLogicType'

const Component = ({
    attributes,
    updateAttributes,
}: NotebookNodeProps<NotebookNodePlaylistAttributes>): JSX.Element => {
    const { filters, pinned, nodeId } = attributes
    const playerKey = `notebook-${nodeId}`

    const recordingPlaylistLogicProps: SessionRecordingPlaylistLogicProps = useMemo(
        () => ({
            logicKey: playerKey,
            filters,
            updateSearchParams: false,
            autoPlay: false,
            onFiltersChange: (newFilters: RecordingFilters) => {
                updateAttributes({
                    filters: newFilters,
                })
            },
            pinnedRecordings: pinned,
            onPinnedChange(recording, isPinned) {
                updateAttributes({
                    pinned: isPinned
                        ? [...(pinned || []), String(recording.id)]
                        : pinned?.filter((id) => id !== recording.id),
                })
            },
        }),
        [playerKey, filters, pinned]
    )

    const { setActions, insertAfter, insertReplayCommentByTimestamp, setMessageListeners, scrollIntoView } =
        useActions(notebookNodeLogic)

    const logic = sessionRecordingsPlaylistLogic(recordingPlaylistLogicProps)
    const { activeSessionRecording } = useValues(logic)
    const { setSelectedRecordingId } = useActions(logic)

    const getReplayLogic = (
        sessionRecordingId?: string
    ): BuiltLogic<sessionRecordingPlayerLogicType> | null | undefined =>
        sessionRecordingId ? sessionRecordingPlayerLogic.findMounted({ playerKey, sessionRecordingId }) : null

    useEffect(() => {
        setActions(
            activeSessionRecording
                ? [
                      {
                          text: 'View replay',
                          onClick: () => {
                              getReplayLogic(activeSessionRecording.id)?.actions.setPause()

                              insertAfter({
                                  type: NotebookNodeType.Recording,
                                  attrs: {
                                      id: String(activeSessionRecording.id),
                                      __init: {
                                          expanded: true,
                                      },
                                  },
                              })
                          },
                      },
                      {
                          text: 'Comment',
                          icon: <IconComment />,
                          onClick: () => {
                              if (activeSessionRecording.id) {
                                  const time = getReplayLogic(activeSessionRecording.id)?.values.currentPlayerTime
                                  insertReplayCommentByTimestamp(time ?? 0, activeSessionRecording.id)
                              }
                          },
                      },
                  ]
                : []
        )
    }, [activeSessionRecording])

    useEffect(() => {
        setMessageListeners({
            'play-replay': ({ sessionRecordingId, time }) => {
                // IDEA: We could add the desired start time here as a param, which is picked up by the player...
                setSelectedRecordingId(sessionRecordingId)
                scrollIntoView()

                setTimeout(() => {
                    // NOTE: This is a hack but we need a delay to give time for the player to mount
                    getReplayLogic(sessionRecordingId)?.actions.seekToTime(time)
                }, 100)
            },
        })
    }, [])

    return <SessionRecordingsPlaylist {...recordingPlaylistLogicProps} />
}

export const Settings = ({
    attributes,
    updateAttributes,
}: NotebookNodeAttributeProperties<NotebookNodePlaylistAttributes>): JSX.Element => {
    const { filters } = attributes
    const [mode, setFilterMode] = useState<SessionRecordingsFilterMode>('simple')
    const defaultFilters = getDefaultFilters()

    return (
        <ErrorBoundary>
            <SessionRecordingsFilters
                filters={{ ...defaultFilters, ...filters }}
                setFilters={(filters) => updateAttributes({ filters })}
                showPropertyFilters
                onReset={() => updateAttributes({ filters: undefined })}
                mode={mode}
                setFilterMode={setFilterMode}
            />
        </ErrorBoundary>
    )
}

type NotebookNodePlaylistAttributes = {
    filters: RecordingFilters
    pinned?: string[]
}

export const NotebookNodePlaylist = createPostHogWidgetNode<NotebookNodePlaylistAttributes>({
    nodeType: NotebookNodeType.RecordingPlaylist,
    titlePlaceholder: 'Session replays',
    Component,
    heightEstimate: 'calc(100vh - 20rem)',
    href: (attrs) => {
        // TODO: Fix parsing of attrs
        return urls.replay(undefined, attrs.filters)
    },
    resizeable: true,
    expandable: false,
    attributes: {
        filters: {
            default: undefined,
        },
        pinned: {
            default: undefined,
        },
    },
    Settings,
})

export function buildPlaylistContent(filters: Partial<FilterType>): JSONContent {
    return {
        type: NotebookNodeType.RecordingPlaylist,
        attrs: { filters },
    }
}
