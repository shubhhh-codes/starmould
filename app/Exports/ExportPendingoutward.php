<?php

namespace App\Exports;

use App\Models\PurchaseModel;
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

class ExportPendingoutward implements FromCollection,WithEvents
{
    /**
    * @return \Illuminate\Support\Collection
    */
    protected $pendingoutwards;

    public function __construct(Collection $pendingoutwards)
    {
        $this->pendingoutwards = $pendingoutwards;
    }
    public function collection()
    {
       
        $data = [];
        $data[] = [
            'Challan No',
            'Date',
            'Vendor Name',
            'Transporter Name',
            'Created by', // Add a header for the purchase details section
        ];
        $data[] = [
            null, 
            'Plate Name',
            'Customer Name',
            'Mould',
            'Particulars',
            'Qty', // Add a header for the purchase items section
            'Location',
        ];
        $data[] = ['', '', '', '', '', ''];
        $blankRow = ['', '', '', '', '', ''];
        // dd($this->pendingoutwards);
        foreach ($this->pendingoutwards as $pendingoutward) {
            // Add purchase details to the data array
           
            $purchaseDetails = [
                'Challan No' => $pendingoutward->challanno,
                'Date' => Carbon::createFromFormat('Y-m-d', $pendingoutward->chdate)->format('d/m/Y'),
                'Vendor Name' => $pendingoutward->vendor->customername,
                'Transporter Name' => $pendingoutward->transporter->customername,
                'Created by' => $pendingoutward->created_by,
            ];
          
            // Add purchase details row
            $data[] = $purchaseDetails;
            // dd($pendingoutward->pendingoutwardItems);
            // Loop through purchase items and add them to the data array
            foreach ($pendingoutward->pendingoutwardItems as $pendingoutwardItem) {
            
                $data[] = [
                    null,
                    'Plate Name' => $pendingoutwardItem->subplate->platename,
                    'Customer Name' => $pendingoutwardItem->customers->customername, 
                    'Mould'=>$pendingoutwardItem->project,
                    'Particulars'=>$pendingoutwardItem->particulars,
                    'Qty' => $pendingoutwardItem->qty,
                    'Location' => $pendingoutwardItem->subplate->location,
                ];
                
            }
            array_push($data, $blankRow);
        }
       
        return collect($data);
    }
    
    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $columnWidths = [
                    'A' => 15,
                    'B' => 20,
                    'C' => 20,
                    'D' => 20,
                    'E' => 20,
                    'F' => 7,
                    'G' => 15,
                   
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
                $sheet->getStyle('B2:G2')->getFont()->setBold(true);
                $range = 'F2:' . $lastColumn . $highestRow;
                $sheet->getStyle($range)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
            },
        ];
    }   
}
