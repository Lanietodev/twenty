import { createContext } from 'react';

import { SpreadsheetImportDialogOptions } from '@/spreadsheet-import/types';
import { isUndefinedOrNull } from '~/utils/isUndefinedOrNull';

export const RsiContext = createContext({} as any);

type ProvidersProps<T extends string> = {
  children: React.ReactNode;
  values: SpreadsheetImportDialogOptions<T>;
};

export const Providers = <T extends string>({
  children,
  values,
}: ProvidersProps<T>) => {
  if (isUndefinedOrNull(values.fields)) {
    throw new Error('Fields must be provided to spreadsheet-import');
  }

  return <RsiContext.Provider value={values}>{children}</RsiContext.Provider>;
};
