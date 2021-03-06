import React, { useMemo, useCallback, MouseEventHandler } from 'react'
import { useGeneralStatus } from '../../lib/generalStatus'
import { useDialog, DialogIconTypes } from '../../lib/dialog'
import { useDb } from '../../lib/db'
import { useRouter, usePathnameWithoutNoteId } from '../../lib/router'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../lib/toast'
import { useFirstUser } from '../../lib/preferences'
import { useContextMenu, MenuTypes, MenuItem } from '../../lib/contextMenu'
import NavigatorItem from '../atoms/NavigatorItem'
import { NoteStorage } from '../../lib/db/types'
import {
  mdiTrashCanOutline,
  mdiPaperclip,
  mdiBookOpen,
  mdiTuneVertical,
  mdiSync,
  mdiPlus,
} from '@mdi/js'
import FolderListFragment from './FolderNavigatorFragment'
import TagListFragment from './TagListFragment'
import NavigatorHeader from '../atoms/NavigatorHeader'
import NavigatorButton from '../atoms/NavigatorButton'
import styled from '../../lib/styled'
import { dispatchNoteDetailFocusTitleInputEvent } from '../../lib/events'
import { useAnalytics, analyticsEvents } from '../../lib/analytics'

const Spacer = styled.div`
  height: 1em;
`

interface StorageNavigatorFragmentProps {
  storage: NoteStorage
}

const StorageNavigatorFragment = ({
  storage,
}: StorageNavigatorFragmentProps) => {
  const { openSideNavFolderItemRecursively, checkFeature } = useGeneralStatus()
  const { prompt, messageBox } = useDialog()
  const {
    createNote,
    createFolder,
    renameFolder,
    renameStorage,
    removeStorage,
    syncStorage,
  } = useDb()
  const { push } = useRouter()
  const { t } = useTranslation()
  const { pushMessage } = useToast()
  const currentPathname = usePathnameWithoutNoteId()
  const user = useFirstUser()
  const { popup } = useContextMenu()
  const { report } = useAnalytics()

  const createNoteInFolderAndRedirect = useCallback(
    async (folderPathname: string) => {
      report(analyticsEvents.createNote)
      const note = await createNote(storage.id, {
        folderPathname,
      })
      if (note == null) {
        return
      }
      push(`/app/storages/${storage.id}/notes${folderPathname}/${note._id}`)
      dispatchNoteDetailFocusTitleInputEvent()
    },
    [storage.id, createNote, push, report]
  )

  const showPromptToCreateFolder = useCallback(
    (folderPathname: string) => {
      prompt({
        title: 'Create a Folder',
        message: 'Enter the path where do you want to create a folder',
        iconType: DialogIconTypes.Question,
        defaultValue: folderPathname === '/' ? '/' : `${folderPathname}/`,
        submitButtonLabel: 'Create Folder',
        onClose: async (value: string | null) => {
          if (value == null) {
            return
          }
          if (value.endsWith('/')) {
            value = value.slice(0, value.length - 1)
          }
          await createFolder(storage.id, value)

          push(`/app/storages/${storage.id}/notes${value}`)

          openSideNavFolderItemRecursively(storage.id, value)
          checkFeature('createFolder')
          report(analyticsEvents.createFolder)
        },
      })
    },
    [
      storage.id,
      prompt,
      createFolder,
      push,
      openSideNavFolderItemRecursively,
      checkFeature,
      report,
    ]
  )

  const showPromptToRenameFolder = (folderPathname: string) => {
    prompt({
      title: t('folder.rename'),
      message: t('folder.renameMessage'),
      iconType: DialogIconTypes.Question,
      defaultValue: folderPathname.split('/').pop(),
      submitButtonLabel: t('folder.rename'),
      onClose: async (value: string | null) => {
        const folderPathSplit = folderPathname.split('/')
        if (value == null || value === '' || value === folderPathSplit.pop()) {
          return
        }
        const newPathname = folderPathSplit.join('/') + '/' + value
        await renameFolder(storage.id, folderPathname, newPathname)
        push(`/app/storages/${storage.id}/notes${newPathname}`)
        openSideNavFolderItemRecursively(storage.id, newPathname)
      },
    })
  }
  const sync = useCallback(() => {
    if (user == null) {
      pushMessage({
        title: 'No User Error',
        description: 'Please login first to sync the storage.',
      })
      return
    }
    syncStorage(storage.id)
  }, [user, storage.id, pushMessage, syncStorage])

  const allNotesPagePathname = `/app/storages/${storage.id}/notes`
  const allNotesPageIsActive = currentPathname === allNotesPagePathname

  const trashcanPagePathname = `/app/storages/${storage.id}/trashcan`
  const trashcanPageIsActive = currentPathname === trashcanPagePathname

  const attachmentsPagePathname = `/app/storages/${storage.id}/attachments`
  const attachmentsPageIsActive = currentPathname === attachmentsPagePathname

  const openContextMenu: MouseEventHandler = useCallback(
    (event) => {
      event.preventDefault()
      const contentMenuItems: MenuItem[] = [
        {
          type: MenuTypes.Normal,
          label: 'New Note',
          onClick: async () => {
            createNoteInFolderAndRedirect('/')
          },
        },
        {
          type: MenuTypes.Normal,
          label: t('folder.create'),
          onClick: async () => {
            showPromptToCreateFolder('/')
          },
        },
      ]

      const storageMenuItems: MenuItem[] = [
        {
          type: MenuTypes.Normal,
          label: t('storage.rename'),
          onClick: async () => {
            prompt({
              title: `Rename "${storage.name}" storage`,
              message: t('storage.renameMessage'),
              iconType: DialogIconTypes.Question,
              defaultValue: storage.name,
              submitButtonLabel: t('storage.rename'),
              onClose: async (value: string | null) => {
                if (value == null) return
                await renameStorage(storage.id, value)
              },
            })
          },
        },
        {
          type: MenuTypes.Normal,
          label: t('storage.remove'),
          onClick: async () => {
            messageBox({
              title: `Remove "${storage.name}" storage`,
              message:
                storage.type === 'fs'
                  ? "This operation won't delete the actual storage folder. You can add it to the app again."
                  : t('storage.removeMessage'),
              iconType: DialogIconTypes.Warning,
              buttons: [t('storage.remove'), t('general.cancel')],
              defaultButtonIndex: 0,
              cancelButtonIndex: 1,
              onClose: (value: number | null) => {
                if (value === 0) {
                  removeStorage(storage.id)
                }
              },
            })
          },
        },
        {
          type: MenuTypes.Normal,
          label: 'Configure Storage',
          onClick: () => push(`/app/storages/${storage.id}/settings`),
        },
      ]
      if (storage.type !== 'fs' && storage.cloudStorage != null) {
        storageMenuItems.unshift({
          type: MenuTypes.Normal,
          label: 'Sync Storage',
          onClick: sync,
        })
      }

      const menuItems: MenuItem[] = [
        ...contentMenuItems,
        {
          type: MenuTypes.Separator,
        },
        ...storageMenuItems,
      ]
      popup(event, menuItems)
    },
    [
      storage,
      popup,
      prompt,
      messageBox,
      createNoteInFolderAndRedirect,
      showPromptToCreateFolder,
      sync,
      t,
      push,
      renameStorage,
      removeStorage,
    ]
  )

  const openNewContextMenu: MouseEventHandler = useCallback(
    (event) => {
      popup(event, [
        {
          type: MenuTypes.Normal,
          label: 'New Note',
          onClick: async () => {
            createNoteInFolderAndRedirect('/')
          },
        },
        {
          type: MenuTypes.Normal,
          label: 'New Folder',
          onClick: async () => {
            showPromptToCreateFolder('/')
          },
        },
      ])
    },
    [popup, createNoteInFolderAndRedirect, showPromptToCreateFolder]
  )

  const openAllNotesContextMenu: MouseEventHandler = useCallback(
    (event) => {
      event.preventDefault()
      popup(event, [
        {
          type: MenuTypes.Normal,
          label: 'New Note',
          onClick: async () => {
            createNoteInFolderAndRedirect('/')
          },
        },
        {
          type: MenuTypes.Normal,
          label: t('folder.create'),
          onClick: async () => {
            showPromptToCreateFolder('/')
          },
        },
      ])
    },
    [t, popup, createNoteInFolderAndRedirect, showPromptToCreateFolder]
  )

  const attachments = useMemo(() => Object.values(storage.attachmentMap), [
    storage.attachmentMap,
  ])
  const trashed = useMemo(
    () => Object.values(storage.noteMap).filter((note) => note!.trashed),
    [storage.noteMap]
  )

  const syncing = storage.type !== 'fs' && storage.sync != null

  return (
    <>
      <NavigatorHeader
        label={storage.name}
        onContextMenu={openContextMenu}
        control={
          <>
            <NavigatorButton onClick={openNewContextMenu} iconPath={mdiPlus} />
            {storage.type !== 'fs' && storage.cloudStorage != null && (
              <NavigatorButton
                active={syncing}
                onClick={sync}
                iconPath={mdiSync}
                spin={syncing}
              />
            )}
            <NavigatorButton
              onClick={() => push(`/app/storages/${storage.id}/settings`)}
              iconPath={mdiTuneVertical}
            />
          </>
        }
      />
      <NavigatorItem
        depth={0}
        label='All Notes'
        iconPath={mdiBookOpen}
        active={allNotesPageIsActive}
        onClick={() => push(allNotesPagePathname)}
        onContextMenu={openAllNotesContextMenu}
        control={
          <NavigatorButton
            iconPath={mdiPlus}
            onClick={openAllNotesContextMenu}
          />
        }
      />
      <FolderListFragment
        storage={storage}
        createNoteInFolderAndRedirect={createNoteInFolderAndRedirect}
        showPromptToCreateFolder={showPromptToCreateFolder}
        showPromptToRenameFolder={showPromptToRenameFolder}
      />
      <TagListFragment storage={storage} />
      {attachments.length > 0 && (
        <NavigatorItem
          depth={0}
          label={t('general.attachments')}
          iconPath={mdiPaperclip}
          active={attachmentsPageIsActive}
          onClick={() => push(attachmentsPagePathname)}
          onContextMenu={(event) => {
            event.preventDefault()
          }}
        />
      )}
      {trashed.length > 0 && (
        <NavigatorItem
          depth={0}
          label={t('general.trash')}
          iconPath={mdiTrashCanOutline}
          active={trashcanPageIsActive}
          onClick={() => push(trashcanPagePathname)}
          onContextMenu={(event) => {
            event.preventDefault()
            // TODO: Implement context menu(restore all notes)
          }}
        />
      )}
      <Spacer />
    </>
  )
}

export default StorageNavigatorFragment
