import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import { actualizarUsuario, crearUsuario, listarUsuarios } from '../../lib/api/administracion'
import type { DatosUsuarioInterno, UsuarioInterno } from '../../lib/api/tipos'
import { ErrorApi } from '../../lib/api/cliente'
import { aplicarErroresCampos, mensajeDe } from '../../lib/errores'
import { formatoFechaHora, formatoMoneda } from '../../lib/formato'
import { Button } from '../../components/ui/Button'
import { DataTable, type Columna } from '../../components/ui/DataTable'
import { Field, Input, Select } from '../../components/ui/Field'
import { Alert, Badge } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import { MoneyInput } from '../../components/ui/MoneyInput'
import { Skeleton } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { EncabezadoPagina } from '../../components/layouts/Comunes'
import { useUsuario } from '../acceso/sesion'

const ROLES: { valor: DatosUsuarioInterno['rol']; texto: string }[] = [
  { valor: 'analista', texto: 'Analista de crédito' },
  { valor: 'oficial', texto: 'Oficial de crédito' },
  { valor: 'contabilidad', texto: 'Auxiliar contable' },
  { valor: 'directivo', texto: 'Directivo' },
  { valor: 'administrador', texto: 'Administrador' },
]

const FUNCION = { parametrizar: 'Parametrizó', aprobar: 'Aprobó créditos', desembolsar: 'Autorizó desembolsos' }

const esquema = z.object({
  nombre_completo: z.string().trim().min(3, 'Escribe el nombre y el apellido.'),
  email: z.string().trim().email('Escribe un correo válido.'),
  rol: z.enum(['analista', 'oficial', 'contabilidad', 'directivo', 'administrador']),
  cargo: z.string().trim().min(2, 'Escribe el cargo.'),
  area: z.string().trim().min(2, 'Escribe el área.'),
  atribucion_monto: z.number().min(0, 'La atribución no puede ser negativa.'),
})

type Datos = z.infer<typeof esquema>

/** Usuarios y roles (8.6.1, UC15). */
export default function UsuariosPagina() {
  const yo = useUsuario()
  const usuarios = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios })
  const [editando, setEditando] = useState<UsuarioInterno | 'nuevo' | null>(null)
  const [bloqueando, setBloqueando] = useState<UsuarioInterno | null>(null)
  const cliente = useQueryClient()
  const { avisar } = useToast()

  const cambioEstado = useMutation({
    mutationFn: (u: UsuarioInterno) => actualizarUsuario(u.id, { estado: u.estado === 'activo' ? 'bloqueado' : 'activo' }),
    onSuccess: (u) => {
      cliente.invalidateQueries({ queryKey: ['usuarios'] })
      setBloqueando(null)
      avisar(u.estado === 'bloqueado' ? `${u.nombre_completo} quedó bloqueado.` : `${u.nombre_completo} quedó activo.`)
    },
  })

  const columnas: Columna<UsuarioInterno>[] = [
    {
      clave: 'nombre',
      titulo: 'Usuario',
      ordenar: (u) => u.nombre_completo,
      celda: (u) => (
        <span className="flex flex-col">
          <span className="font-medium">{u.nombre_completo}</span>
          <span className="text-xs text-tinta-tenue">{u.email}</span>
        </span>
      ),
    },
    { clave: 'rol', titulo: 'Rol', ordenar: (u) => u.rol, celda: (u) => ROLES.find((r) => r.valor === u.rol)?.texto },
    { clave: 'area', titulo: 'Área', ordenar: (u) => u.area, celda: (u) => u.area },
    {
      clave: 'atribucion',
      titulo: 'Atribución',
      alinear: 'derecha',
      className: 'cifras',
      ordenar: (u) => u.atribucion_monto,
      celda: (u) => (u.rol === 'oficial' ? formatoMoneda(u.atribucion_monto) : '—'),
    },
    {
      clave: 'funciones',
      titulo: 'Funciones ejercidas',
      celda: (u) =>
        u.funciones_ejercidas.length ? (
          <span className="flex flex-wrap gap-1">
            {u.funciones_ejercidas.map((f) => (
              <Badge key={f}>{FUNCION[f]}</Badge>
            ))}
          </span>
        ) : (
          <span className="text-tinta-tenue">Ninguna</span>
        ),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      ordenar: (u) => u.estado,
      celda: (u) => <Badge tono={u.estado === 'activo' ? 'exito' : 'negado'}>{u.estado === 'activo' ? 'Activo' : u.estado === 'bloqueado' ? 'Bloqueado' : 'Inactivo'}</Badge>,
    },
    {
      clave: 'acceso',
      titulo: 'Último acceso',
      ordenar: (u) => u.ultimo_acceso_en ?? '',
      celda: (u) => <span className="text-tinta-suave">{u.ultimo_acceso_en ? formatoFechaHora(u.ultimo_acceso_en) : 'Nunca'}</span>,
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      celda: (u) => (
        <span className="flex gap-1">
          <Button variante="fantasma" tamano="sm" onClick={() => setEditando(u)} aria-label={`Editar a ${u.nombre_completo}`}>
            Editar
          </Button>
          {u.id !== yo.id ? (
            <Button variante="fantasma" tamano="sm" onClick={() => setBloqueando(u)} aria-label={`${u.estado === 'activo' ? 'Bloquear' : 'Desbloquear'} a ${u.nombre_completo}`}>
              {u.estado === 'activo' ? 'Bloquear' : 'Desbloquear'}
            </Button>
          ) : null}
        </span>
      ),
    },
  ]

  return (
    <div>
      <EncabezadoPagina
        titulo="Usuarios y roles"
        descripcion="Una misma persona no puede parametrizar, aprobar y desembolsar: el sistema bloquea las asignaciones que rompan esa segregación."
        acciones={
          <Button icono={<UserPlus aria-hidden="true" className="size-4" />} onClick={() => setEditando('nuevo')}>
            Nuevo usuario
          </Button>
        }
      />
      {usuarios.isError ? <Alert tono="error">{mensajeDe(usuarios.error)}</Alert> : null}
      {usuarios.data ? (
        <DataTable etiqueta="Usuarios internos" columnas={columnas} filas={usuarios.data} clave={(u) => u.id} ordenInicial={{ clave: 'nombre', direccion: 'asc' }} />
      ) : usuarios.isPending ? (
        <Skeleton className="h-64" />
      ) : null}

      {editando ? <FormularioUsuario usuario={editando === 'nuevo' ? null : editando} onCerrar={() => setEditando(null)} /> : null}

      <Modal
        abierto={bloqueando !== null}
        onCerrar={() => setBloqueando(null)}
        titulo={bloqueando?.estado === 'activo' ? `¿Bloquear a ${bloqueando?.nombre_completo}?` : `¿Desbloquear a ${bloqueando?.nombre_completo}?`}
        descripcion={
          bloqueando?.estado === 'activo'
            ? 'No podrá iniciar sesión hasta que lo desbloquees. Sus decisiones y registros anteriores se conservan.'
            : 'Podrá volver a iniciar sesión con su contraseña y segundo factor.'
        }
        acciones={
          <>
            <Button variante="secundario" onClick={() => setBloqueando(null)}>
              Cancelar
            </Button>
            <Button
              variante={bloqueando?.estado === 'activo' ? 'peligro' : 'primario'}
              cargando={cambioEstado.isPending}
              onClick={() => bloqueando && cambioEstado.mutate(bloqueando)}
            >
              {bloqueando?.estado === 'activo' ? 'Bloquear' : 'Desbloquear'}
            </Button>
          </>
        }
      >
        {cambioEstado.isError ? <Alert tono="error">{mensajeDe(cambioEstado.error)}</Alert> : null}
      </Modal>
    </div>
  )
}

function FormularioUsuario({ usuario, onCerrar }: { usuario: UsuarioInterno | null; onCerrar: () => void }) {
  const cliente = useQueryClient()
  const { avisar } = useToast()
  const [errorGeneral, setErrorGeneral] = useState<string>()
  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: usuario
      ? { nombre_completo: usuario.nombre_completo, email: usuario.email, rol: usuario.rol, cargo: usuario.cargo, area: usuario.area, atribucion_monto: usuario.atribucion_monto }
      : { nombre_completo: '', email: '', rol: 'analista', cargo: '', area: '', atribucion_monto: 0 },
  })
  const rol = watch('rol')

  const guardado = useMutation({
    mutationFn: (datos: Datos) => (usuario ? actualizarUsuario(usuario.id, datos) : crearUsuario(datos)),
    onSuccess: (u) => {
      cliente.invalidateQueries({ queryKey: ['usuarios'] })
      avisar(usuario ? `Guardamos los cambios de ${u.nombre_completo}.` : `Creamos el usuario de ${u.nombre_completo}. Le enviamos un correo para activar su cuenta.`)
      onCerrar()
    },
    onError: (error) => {
      const sueltos = aplicarErroresCampos(error, setError, Object.keys(esquema.shape))
      const enCampos = error instanceof ErrorApi && Object.keys(error.campos).length > sueltos.length
      // Los errores de negocio (por ejemplo, la segregación de funciones) van en el aviso general.
      setErrorGeneral(sueltos[0] ?? (enCampos ? undefined : mensajeDe(error)))
    },
  })

  return (
    <Modal abierto onCerrar={onCerrar} titulo={usuario ? `Editar a ${usuario.nombre_completo}` : 'Nuevo usuario'}>
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((datos) => guardado.mutate(datos))}>
        <Field id="usuario-nombre" etiqueta="Nombre completo" error={errors.nombre_completo?.message}>
          <Input autoComplete="off" {...register('nombre_completo')} />
        </Field>
        <Field id="usuario-email" etiqueta="Correo institucional" error={errors.email?.message}>
          <Input type="email" spellCheck={false} autoComplete="off" {...register('email')} />
        </Field>
        <Field id="usuario-rol" etiqueta="Rol" error={errors.rol?.message}>
          <Select {...register('rol')}>
            {ROLES.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.texto}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="usuario-cargo" etiqueta="Cargo" error={errors.cargo?.message}>
            <Input {...register('cargo')} />
          </Field>
          <Field id="usuario-area" etiqueta="Área" error={errors.area?.message}>
            <Input {...register('area')} />
          </Field>
        </div>
        {rol === 'oficial' ? (
          <Field id="usuario-atribucion" etiqueta="Atribución por monto" ayuda="Monto máximo que puede aprobar sin ir a comité." error={errors.atribucion_monto?.message}>
            <Controller control={control} name="atribucion_monto" render={({ field }) => <MoneyInput valor={field.value} onCambiar={(v) => field.onChange(v ?? 0)} />} />
          </Field>
        ) : null}
        {errorGeneral ? <Alert tono="error">{errorGeneral}</Alert> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variante="secundario" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" cargando={guardado.isPending}>
            {usuario ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
