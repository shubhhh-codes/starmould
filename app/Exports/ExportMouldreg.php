<?php

namespace App\Exports;

use App\Models\WorkModel;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Events\AfterSheet;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Sheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ExportMouldreg implements FromCollection,WithEvents
{
    /**
    * @return \Illuminate\Support\Collection
    */
    protected $mouldsreg;

    public function __construct(Collection $mouldsreg)
    {
        $this->mouldsreg = $mouldsreg;
    }
    public function collection()
    {
       
        $data = [];
        $data[] = [
            'Received Dt',
            'Dispatch Dt',
            'Customer Name',
            'Mould/Part Name',
            // 'Note',
            'Mould',
            'Worktype',
            // 'Machine Hour',   
        ];
        $data[] = [
            null, 
            'Plate Name',
            'Subproject',
            'Shape',
            'Material',
            'W(OD)',
            'H(ID)',
            'Length',
            'Weight',
            'Unit',
            
            'Qty', // Add a header for the purchase items section
        ];
        $data[] = ['', '', '', '', '', ''];
        $blankRow = ['', '', '', '', '', ''];
       
        foreach ($this->mouldsreg as $mould) {
            $scanTime = $this->calculateMachineHour($mould->id);
            // Add purchase details to the data array
            $purchaseDetails = [
                'Received Date' => Carbon::createFromFormat('Y-m-d', $mould->rdate)->format('d/m/Y'),
                'Dispatch Date' => Carbon::createFromFormat('Y-m-d', $mould->dispatchdate,)->format('d/m/Y'),
                'Customer Name' => isset($mould->customer->customername) ? $mould->customer->customername : null,
               
                'Mould/Part Name' => $mould->description,
                // 'Note' => $mould->note,
                'Mould' => $mould->projectid,
                'Worktype' => $mould->worktype,
                // 'Machine Hour' => $scanTime,
            ];
          
            // Add purchase details row
            $data[] = $purchaseDetails;
            
            // Loop through purchase items and add them to the data array
            foreach ($mould->subPlates as $subPlate) {
                $data[] = [
                    null, 
                    'Plate Name' => $subPlate->platename,
                    'Subproject' => $subPlate->subprojectid,
                    'Shape' => $subPlate->shape,
                    'Material' => $subPlate->material,
                    'W(OD)' => $subPlate->width,
                    'H(ID)' => $subPlate->height,
                    'Length' => $subPlate->length,
                    'Weight' => $subPlate->weight,
                    'Unit' => $subPlate->unit,
                    
                    'Qty' => $subPlate->sqty,
                ];
                
            }
            array_push($data, $blankRow);
        }
       
        return collect($data);
    }
    private function calculateMachineHour($mouldId) 
    {
        $data = WorkModel::select(WorkModel::raw('SEC_TO_TIME(SUM(TIME_TO_SEC(worklog.work_hr))) as total_time'), 'worklog.scan_print_id')
            ->where('worklog.scan_print_id', $mouldId)
            ->groupBy('worklog.scan_print_id')
            ->get();
    
        $scanTime = '00:00';
    
        if (!$data->isEmpty()) {
            $scanTimeParts = explode(':', $data[0]->total_time);
            $hours = (int)$scanTimeParts[0];
            $minutes = (int)$scanTimeParts[1];
    
            // Ensure hours do not exceed 24
            // $hours %= 24;
    
            $scanTime = sprintf("%02d:%02d", $hours, $minutes);
        }
        return $scanTime;
    }
    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $columnWidths = [
                    'A' => 12,
                    'B' => 12,
                    'C' => 20,
                    'D' => 17,
                    'E' => 14,
                    'F' => 10,
                    'G' => 7,
                    'H' => 7,
                    'I' => 8,
                    'J' => 5,
                    'K' => 5,
                ];
                foreach ($columnWidths as $column => $width) {
                    $sheet->getColumnDimension($column)->setWidth($width);
                }
                $highestRow = $sheet->getHighestRow();
                $highestColumn = $sheet->getHighestColumn();
                
                for ($row = 1; $row <= $highestRow; $row++) {
                    for ($col = 'A'; $col <= $highestColumn; $col++) {
                        $sheet->getStyle($col . $row)->getAlignment()->setWrapText(true);
                    }
                }
                $headerRow = 1; // Assuming header is in the first row
                
                foreach ($sheet->getRowIterator() as $row) {
                    $rowNumber = $row->getRowIndex();
                    
                    if ($rowNumber === $headerRow) {
                        // Skip header row
                        continue;
                    }
                    
                    $cellIterator = $row->getCellIterator();
                    $cellIterator->setIterateOnlyExistingCells(false);
                    
                    foreach ($cellIterator as $cell) {
                        if ($cell->getValue() !== null && $cell->getColumn() === 'A') {
                            $lastColumn = $sheet->getHighestColumn();
                            $sheet->getStyle('A' . $rowNumber . ':' . $lastColumn . $rowNumber)
                                ->getFill()
                                ->setFillType(Fill::FILL_SOLID)
                                ->getStartColor()->setARGB('D9D9D9'); // Change 'FFFF00' to your desired color code
                            break; // Exit the loop once background color is applied to the row
                        }
                    }
                }

                // Styling for header row
                $lastColumn = $sheet->getHighestColumn(); // Get the last column again for the header row
                $sheet->getStyle('A' . $headerRow . ':' . $lastColumn . $headerRow)->getFont()->setBold(true);
                $sheet->getStyle('B2:K2')->getFont()->setBold(true);
                $range = 'F2:' . $lastColumn . $highestRow;
                $sheet->getStyle($range)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
            },
        ];
    }   
}
