import * as React from "react";

export type FieldAria = { id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string };

/**
 * Lets <Field> inject id / aria-* into a control rendered through react-hook-form's <Controller>
 * (Field clones its direct child; Controller itself would drop those props).
 */
export function Bind({
  render,
  ...aria
}: { render: (aria: FieldAria) => React.ReactNode } & FieldAria) {
  return <>{render(aria)}</>;
}
