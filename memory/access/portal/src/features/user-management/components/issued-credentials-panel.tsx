import { motion } from 'framer-motion'
import { ShieldAlert } from 'lucide-react'
import { CopyableSecret } from '@/shared/components/copyable-secret'
import { formatDateTime } from '@/shared/lib/format-date'
import { fadeUpVariants } from '@/shared/motion/motion-presets'
import { StaggerGroup } from '@/shared/motion/stagger-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import type { IssuedCredentials } from '../types/issued-credentials'

/** Lo recien emitido. El servidor no lo vuelve a mostrar, asi que el aviso va primero. */
export function IssuedCredentialsPanel({ credentials }: { credentials: IssuedCredentials }) {
  const { invitation, mcpToken, commands } = credentials
  return (
    <StaggerGroup className="space-y-4" stagger={0.07}>
      <motion.div variants={fadeUpVariants} className="flex gap-3 rounded-xl border border-amber/40 bg-amber/10 p-3 text-sm">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />
        <p>Cópialo ahora y envíaselo a {credentials.userId} por un canal privado. No se vuelve a mostrar.</p>
      </motion.div>
      {invitation ? (
        <motion.div variants={fadeUpVariants} className="space-y-1.5">
          <CopyableSecret label="Enlace de invitación al portal" value={invitation.link} />
          <p className="text-xs text-muted-foreground">De un solo uso. Caduca el {formatDateTime(invitation.expiresAt)}.</p>
        </motion.div>
      ) : null}
      {mcpToken ? (
        <motion.div variants={fadeUpVariants} className="space-y-3">
          <CopyableSecret label="Token del MCP" value={mcpToken} masked />
          {commands ? (
            <Tabs defaultValue="windows">
              <TabsList>
                <TabsTrigger value="windows">Windows</TabsTrigger>
                <TabsTrigger value="unix">Mac / Linux</TabsTrigger>
              </TabsList>
              <TabsContent value="windows">
                <CopyableSecret label="Comando de conexión" value={commands.windows} />
              </TabsContent>
              <TabsContent value="unix">
                <CopyableSecret label="Comando de conexión" value={commands.unix} />
              </TabsContent>
            </Tabs>
          ) : null}
        </motion.div>
      ) : null}
    </StaggerGroup>
  )
}
