import { z } from "zod"

export type MethodKind = "query" | "command"

export type FcpMethodDef<
  Name extends string = string,
  Params extends z.ZodType = z.ZodType,
  Result extends z.ZodType = z.ZodType,
  Kind extends MethodKind = MethodKind,
> = {
  readonly name: Name
  readonly params: Params
  readonly result: Result
  readonly kind: Kind
}

export type FcpNotificationDef<
  Name extends string = string,
  Params extends z.ZodType = z.ZodType,
> = {
  readonly name: Name
  readonly params: Params
}

export function defineMethod<
  Name extends string,
  Params extends z.ZodType,
  Result extends z.ZodType,
  Kind extends MethodKind,
>(
  def: FcpMethodDef<Name, Params, Result, Kind>
): FcpMethodDef<Name, Params, Result, Kind> {
  return def
}

export function defineNotification<
  Name extends string,
  Params extends z.ZodType,
>(def: FcpNotificationDef<Name, Params>): FcpNotificationDef<Name, Params> {
  return def
}

export type FcpMethodParams<M extends FcpMethodDef> = z.infer<M["params"]>
export type FcpMethodResult<M extends FcpMethodDef> = z.infer<M["result"]>
export type FcpNotificationParams<N extends FcpNotificationDef> = z.infer<
  N["params"]
>
