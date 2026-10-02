import { Layers } from 'lucide-react'
import { useCallback, useState } from 'react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { PageHeader } from '@/shared/components/page-header'
import { FadeIn } from '@/shared/motion/fade-in'
import { toast } from '@/shared/toast/toast'
import { AssignNamespaceDialog } from '../components/assign-namespace-dialog'
import { NamespacesTable } from '../components/namespaces-table'
import { useNamespaces, useRemoveAlias } from '../hooks/use-space-queries'
import type { NamespaceRow } from '../types/space-types'

export function SpaceManagementPage() {
  const { data: rows = [], isLoading, error } = useNamespaces()
  const remove = useRemoveAlias()
  const [assigning, setAssigning] = useState<NamespaceRow | null>(null)
  const unassigned = rows.filter((row) => !row.space && row.count > 0)

  const handleRemove = useCallback(
    (row: NamespaceRow) => remove.mutate(row.namespace, { onSuccess: () => toast.success('Asignación quitada', `${row.namespace} vuelve a quedar sin espacio.`), onError: (e) => toast.error('No se pudo quitar', describeApiError(e)) }),
    [remove],
  )

  return (
    <div className="space-y-8">
      <PageHeader
        title="Espacios"
        description="Cada namespace de Mem0 pertenece a un espacio: global, proyecto, cliente interno o cliente. Asigna aquí los antiguos; las memorias no se mueven, solo cambia quién las ve."
      />
      {unassigned.length > 0 ? (
        <FadeIn className="flex items-start gap-3 rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm">
          <Layers className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />
          <p>
            Hay <span className="font-semibold">{unassigned.length}</span> namespace{unassigned.length === 1 ? '' : 's'} con memorias sin espacio ({unassigned.map((row) => row.namespace).join(', ')}). Solo los administradores las ven hasta que se asignen.
          </p>
        </FadeIn>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {describeApiError(error)}
        </p>
      ) : null}
      <FadeIn delay={0.1}>
        <NamespacesTable rows={rows} isLoading={isLoading} onAssign={setAssigning} onRemove={handleRemove} />
      </FadeIn>
      <AssignNamespaceDialog row={assigning} onClose={() => setAssigning(null)} />
    </div>
  )
}
