import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useCallback, useState } from 'react';

import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import { exceedsMaxRecords } from '@/spreadsheet-import/utils/exceedsMaxRecords';
import { mapWorkbook } from '@/spreadsheet-import/utils/mapWorkbook';
import { CircularProgressBar } from '@/ui/feedback/progress-bar/components/CircularProgressBar';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Modal } from '@/ui/layout/modal/components/Modal';

import { SpreadsheetImportStep } from '@/spreadsheet-import/steps/types/SpreadsheetImportStep';
import { SpreadsheetImportStepType } from '@/spreadsheet-import/steps/types/SpreadsheetImportStepType';
import { MatchColumnsStep } from './MatchColumnsStep/MatchColumnsStep';
import { SelectHeaderStep } from './SelectHeaderStep/SelectHeaderStep';
import { SelectSheetStep } from './SelectSheetStep/SelectSheetStep';
import { UploadStep } from './UploadStep/UploadStep';
import { ValidationStep } from './ValidationStep/ValidationStep';

const StyledProgressBarContainer = styled(Modal.Content)`
  align-items: center;
  display: flex;
  justify-content: center;
`;

type SpreadsheetImportStepperProps = {
  nextStep: () => void;
  prevStep: () => void;
};

export const SpreadsheetImportStepper = ({
  nextStep,
  prevStep,
}: SpreadsheetImportStepperProps) => {
  const theme = useTheme();

  const { initialStepState } = useSpreadsheetImportInternal();

  const [state, setState] = useState<SpreadsheetImportStep>(
    initialStepState || { type: SpreadsheetImportStepType.upload },
  );
  const [previousState, setPreviousState] = useState<SpreadsheetImportStep>(
    initialStepState || { type: SpreadsheetImportStepType.upload },
  );

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const {
    maxRecords,
    uploadStepHook,
    selectHeaderStepHook,
    matchColumnsStepHook,
    selectHeader,
  } = useSpreadsheetImportInternal();
  const { enqueueSnackBar } = useSnackBar();

  const errorToast = useCallback(
    (description: string) => {
      enqueueSnackBar(description, {
        title: 'Error',
        variant: SnackBarVariant.Error,
      });
    },
    [enqueueSnackBar],
  );

  const onBack = useCallback(() => {
    setState(previousState);
    prevStep();
  }, [prevStep, previousState]);

  switch (state.type) {
    case SpreadsheetImportStepType.upload:
      return (
        <UploadStep
          onContinue={async (workbook, file) => {
            setUploadedFile(file);
            const isSingleSheet = workbook.SheetNames.length === 1;
            if (isSingleSheet) {
              if (
                maxRecords > 0 &&
                exceedsMaxRecords(
                  workbook.Sheets[workbook.SheetNames[0]],
                  maxRecords,
                )
              ) {
                errorToast(
                  `Too many records. Up to ${maxRecords.toString()} allowed`,
                );
                return;
              }
              try {
                const mappedWorkbook = await uploadStepHook(
                  mapWorkbook(workbook),
                );

                if (selectHeader) {
                  setState({
                    type: SpreadsheetImportStepType.selectHeader,
                    data: mappedWorkbook,
                  });
                } else {
                  // Automatically select first row as header
                  const trimmedData = mappedWorkbook.slice(1);

                  const { importedRows: data, headerRow: headerValues } =
                    await selectHeaderStepHook(mappedWorkbook[0], trimmedData);

                  setState({
                    type: SpreadsheetImportStepType.matchColumns,
                    data,
                    headerValues,
                  });
                }
              } catch (e) {
                errorToast((e as Error).message);
              }
            } else {
              setState({
                type: SpreadsheetImportStepType.selectSheet,
                workbook,
              });
            }
            setPreviousState(state);
            nextStep();
          }}
        />
      );
    case SpreadsheetImportStepType.selectSheet:
      return (
        <SelectSheetStep
          sheetNames={state.workbook.SheetNames}
          onContinue={async (sheetName) => {
            if (
              maxRecords > 0 &&
              exceedsMaxRecords(state.workbook.Sheets[sheetName], maxRecords)
            ) {
              errorToast(
                `Too many records. Up to ${maxRecords.toString()} allowed`,
              );
              return;
            }
            try {
              const mappedWorkbook = await uploadStepHook(
                mapWorkbook(state.workbook, sheetName),
              );
              setState({
                type: SpreadsheetImportStepType.selectHeader,
                data: mappedWorkbook,
              });
              setPreviousState(state);
            } catch (e) {
              errorToast((e as Error).message);
            }
          }}
          onBack={onBack}
        />
      );
    case SpreadsheetImportStepType.selectHeader:
      return (
        <SelectHeaderStep
          importedRows={state.data}
          onContinue={async (...args) => {
            try {
              const { importedRows: data, headerRow: headerValues } =
                await selectHeaderStepHook(...args);
              setState({
                type: SpreadsheetImportStepType.matchColumns,
                data,
                headerValues,
              });
              setPreviousState(state);
              nextStep();
            } catch (e) {
              errorToast((e as Error).message);
            }
          }}
          onBack={onBack}
        />
      );
    case SpreadsheetImportStepType.matchColumns:
      return (
        <MatchColumnsStep
          data={state.data}
          headerValues={state.headerValues}
          onContinue={async (values, rawData, columns) => {
            try {
              const data = await matchColumnsStepHook(values, rawData, columns);
              setState({
                type: SpreadsheetImportStepType.validateData,
                data,
                importedColumns: columns,
              });
              setPreviousState(state);
              nextStep();
            } catch (e) {
              errorToast((e as Error).message);
            }
          }}
          onBack={
            // TODO: implement
            () => {}
          }
        />
      );
    case SpreadsheetImportStepType.validateData:
      if (!uploadedFile) {
        throw new Error('File not found');
      }
      return (
        <ValidationStep
          initialData={state.data}
          importedColumns={state.importedColumns}
          file={uploadedFile}
          onSubmitStart={() =>
            setState({
              type: SpreadsheetImportStepType.loading,
            })
          }
          onBack={() => {
            onBack();
            setPreviousState(
              initialStepState || { type: SpreadsheetImportStepType.upload },
            );
          }}
        />
      );
    case SpreadsheetImportStepType.loading:
    default:
      return (
        <StyledProgressBarContainer>
          <CircularProgressBar
            size={80}
            barWidth={8}
            barColor={theme.font.color.primary}
          />
        </StyledProgressBarContainer>
      );
  }
};
