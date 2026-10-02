import { Layers } from 'lucide-react'
import { useCallback, useState } from 'react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { PageHeader } from '@/shared/components/page-header'
import { FadeIn } from '@/shared/motion/fade-in'
import { toast } from '@/shared/toast/toast'
import { useUsers } from '@/features/user-management/hooks/use-users'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { AssignNamespaceDialog } from '../components/assign-namespace-dialog'
import { NamespacesTable } from '../components/namespaces-table'
import { PermissionsModeCard } from '../components/permissions-mode-card'
import { useKbProjects, useNamespaces, useRemoveAlias } from '../hooks/use-space-queries'
import type { AliasKind, NamespaceRow } from '../types/space-types'

export function SpaceManagementPage() {
  const [kind, setKind] = useState<AliasKind>('mem0')
  const mem0 = useNamespaces()
  const notes = useKbProjects()
  const { data: users = [] } = useUsers()
  const remove = useRemoveAlias()
  const [assigning, setAssigning] = useState<NamespaceRow | null>(null)

  const current = kind === 'mem0' ? mem0 : notes
  const rows = current.data ?? []
  const allRows = [...(mem0.data ?? []), ...(notes.data ?? [])]
  const unassigned = rows.filter((row) => !row.space && (row.count ?? 1) > 0)

  const handleRemove = useCallback(
    (row: NamespaceRow) =>
      remove.mutate(
        { kind, namespace: row.namespace },
        { onSuccess: () => toast.success('Asignación quitada', `${row.namespace} vuelve a quedar sin espacio.`), onError: (e) => toast.error('No se pudo quitar', describeApiError(e)) },
      ),
    [remove, kind],
  )

  return (
    <div className="space-y-8">
      <PageHeader
        title="Espacios"
        description="Cada namespace de Mem0 y cada proyecto de notas pertenece a un espacio: global, proyecto, cliente interno o cliente. Asigna aquí los antiguos; nada se mueve, solo cambia quién lo ve."
      />
      <PermissionsModeCard users={users} rows={allRows} />
      <Tabs value={kind} onValueChange={(next) => setKind(next as AliasKind)}>
        <TabsList>
          <TabsTrigger value="mem0">Memorias (Mem0)</TabsTrigger>
          <TabsTrigger value="kb">Notas (Basic Memory)</TabsTrigger>
        </TabsList>
      </Tabs>
      {unassigned.length > 0 ? (
        <FadeIn className="flex items-start gap-3 rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm">
          <Layers className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />
          <p>
            Hay <span className="font-semibold">{unassigned.length}</span> {kind === 'kb' ? 'proyecto' : 'namespace'}
            {unassigned.length === 1 ? '' : 's'} sin espacio ({unassigned.map((row) => row.namespace).join(', ')}). Solo los administradores {kind === 'kb' ? 'ven esas notas' : 'ven esas memorias'} hasta que se asignen.
          </p>
        </FadeIn>
      ) : null}
      {current.error ? (
        <p className="text-sm text-destructive" role="alert">
          {describeApiError(current.error)}
        </p>
      ) : null}
      <FadeIn delay={0.1}>
        <NamespacesTable kind={kind} rows={rows} isLoading={current.isLoading} onAssign={setAssigning} onRemove={handleRemove} />
      </FadeIn>
      <AssignNamespaceDialog kind={kind} row={assigning} onClose={() => setAssigning(null)} />
    </div>
  )
}
