<?php

namespace App\Exports;

use App\Models\WorkModel;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Events\BeforeSheet;
use Maatwebsite\Excel\Events\AfterSheet;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Sheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ExportMould implements FromCollection,WithEvents
{
    /**
    * @return \Illuminate\Support\Collection
    */
    protected $moulds;

    public function __construct(Collection $moulds)
    {
        $this->moulds = $moulds;
    }
    public function collection()
    {
       
        $data = [];
        $data[] = [
            'Received Dt',
            // 'Committed Date',
            'Customer Name',
            'Mould/Part Name',
            'Mould',
            'Worktype',
            // 'Note',
            
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
       
        foreach ($this->moulds as $mould) {
            // $scanTime = $this->calculateMachineHour($mould->id);
            // Add purchase details to the data array
            $purchaseDetails = [
                'Received Dt' => Carbon::createFromFormat('Y-m-d', $mould->rdate)->format('d/m/Y'),
                // 'Committed Date' => Carbon::createFromFormat('Y-m-d', $mould->cdate,)->format('d/m/Y'),
                'Customer Name' => $mould->customer->customername,
                
                'Mould/Part Name' => $mould->description,
                'Mould' => $mould->projectid,
                'Worktype' => $mould->worktype,
                // 'Note' => $mould->note,
            
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
    // private function calculateMachineHour($mouldId) {
    //     $data = WorkModel::select(WorkModel::raw('SEC_TO_TIME(SUM(TIME_TO_SEC(worklog.work_hr))) as total_time'), 'worklog.scan_print_id')
    //         ->where('worklog.scan_print_id', $mouldId)
    //         ->groupBy('worklog.scan_print_id')
    //         ->get();
    
    //     $scanTime = '00:00';
    
    //     if (!$data->isEmpty()) {
    //         $scanTimeParts = explode(':', $data[0]->total_time);
    //         $hours = (int)$scanTimeParts[0];
    //         $minutes = (int)$scanTimeParts[1];
    
    //         // Ensure hours do not exceed 24
    //         // $hours %= 24;
    
    //         $scanTime = sprintf("%02d:%02d", $hours, $minutes);
    //     }
    //     return $scanTime;
    // }
    public function registerEvents(): array
    {
        return [
            // BeforeSheet::class => function (BeforeSheet $event) {
            //     $event->sheet
            //         ->getPageSetup()
            //         ->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);
            // },
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $columnWidths = [
                    'A' => 12,
                    'B' => 20,
                    'C' => 20,
                    'D' => 14,
                    'E' => 12,
                    'F' => 7,
                    'G' => 7,
                    'H' => 7,
                    'I' => 8,
                    'J' => 7,
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
                // $sheet->getStyle('K')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $range = 'F2:' . $lastColumn . $highestRow;
                $sheet->getStyle($range)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
            },
        ];
    }   
}
