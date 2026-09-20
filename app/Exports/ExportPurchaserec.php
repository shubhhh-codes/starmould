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

class ExportPurchaserec implements FromCollection,WithEvents
{
    /**
    * @return \Illuminate\Support\Collection
    */
    protected $purchasesrec;

    public function __construct(Collection $purchasesrec)
    {
        $this->purchasesrec = $purchasesrec;
    }
    public function collection()
    {
       
        $data = [];
        $data[] = [
            'Po.No.',
            'Order Date',
            'Mould',
            'Description',
            'Supplier Name',
            'Customer Name',
        ];
        $data[] = [
            null, 
            'Plate Name',
            'Material',
            'Material Type',
            'Qty', // Add a header for the purchase items section
        ];
        $data[] = ['', '', '', '', '', ''];
        $blankRow = ['', '', '', '', '', ''];
       
        foreach ($this->purchasesrec as $purchaser) {
            // Add purchase details to the data array
            $purchaseDetails = [
                'Po.No.' => $purchaser->srno,
                'Order Date' => Carbon::createFromFormat('Y-m-d', $purchaser->odate)->format('d/m/Y'),
                'Mould' => $purchaser->projectid,
                'Description' => $purchaser->scanning->description,
                'Supplier Name' => $purchaser->vendor->customername,
                'Customer Name' => $purchaser->customer->customername,
            ];
          
            // Add purchase details row
            $data[] = $purchaseDetails;
            // dd($purchaser->purchaseinwardItems);
            // Loop through purchase items and add them to the data array
            foreach ($purchaser->purchaseinwardItems as $purchaserItem) {
                $data[] = [
                    null,
                    'Plate Name' => $purchaserItem->subplate->platename,
                    'Material' => $purchaserItem->material,
                    'Material Type' => $purchaserItem->materialtype,
                    'Qty' => $purchaserItem->qty,
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
                    'A' => 12,
                    'B' => 21,
                    'C' => 20,
                    'D' => 17,
                    'E' => 15,
                    'F' => 15,
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
                $sheet->getStyle('B2:E2')->getFont()->setBold(true);
                $range = 'F2:' . $lastColumn . $highestRow;
                $sheet->getStyle($range)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
            },
        ];
    }


   
}
