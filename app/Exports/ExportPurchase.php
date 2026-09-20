<?php

namespace App\Exports;

use App\Models\PurchaseModel;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Events\AfterSheet;
use Maatwebsite\Excel\Concerns\WithEvents;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Sheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ExportPurchase implements FromCollection,WithEvents
{
    /**
    * @return \Illuminate\Support\Collection
    */
    protected $purchases;

    public function __construct(Collection $purchases)
    {
        $this->purchases = $purchases;
    }
    public function collection()
    {
       
        $data = [];
        $data[] = [
            'Po.No.',
            'Order Date',
            'Supplier Name',
            'Customer Name',
            'Mould',
            'Created by', // Add a header for the purchase details section
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
       
        foreach ($this->purchases as $purchase) {
            // Add purchase details to the data array
            $purchaseDetails = [
                'Po.No.' => $purchase->srno,
                'Order Date' => Carbon::createFromFormat('Y-m-d', $purchase->odate)->format('d/m/Y'),
                'Supplier Name' => isset($purchase->vendor->customername) ? $purchase->vendor->customername : null,
                'Customer Name' => isset($purchase->customer->customername) ? $purchase->customer->customername : null,
                'Mould' => $purchase->projectid,
                'Created by'=> $purchase->created_by,
                
            ];
          
            // Add purchase details row
            $data[] = $purchaseDetails;
            
            // Loop through purchase items and add them to the data array
            foreach ($purchase->purchaseItems as $purchaseItem) {
                $data[] = [
                    null,
                    'Plate Name' => $purchaseItem->subplate->platename,
                    'Material' => $purchaseItem->material,
                    'Material Type' => $purchaseItem->materialtype,
                    'Qty' => $purchaseItem->qty,
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
                    'D' => 15,
                    'E' => 15,
                    'F' => 12,
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


    // public function collection()
    // {
    //     $data = [];

    //     foreach ($this->purchases as $purchase) {
    //         // Add purchase details to the data array
    //         $purchaseDetails = [
    //             'Po.No.' => $purchase->srno,
    //             'Order Date' => $purchase->oate,
    //             'Supplier Name' => $purchase->vname,
    //             'Customer Name' => $purchase->cname,
    //         ];

    //         // Loop through purchase items and add them to the data array
    //         foreach ($purchase->purchaseItems as $purchaseItem) {
    //             $data[] = array_merge($purchaseDetails, [
    //                 'Plate Name' => $purchaseItem->plateid,
    //                 'Material' => $purchaseItem->material,
    //                 'Material Type' => $purchaseItem->materialtype,
    //                 'Qty' => $purchaseItem->qty,
    //             ]);
    //         }
    //     }

    //     return collect($data);
    // }
    
    // public function collection()
    // {
       
    //     $data = [];
    
    //     foreach ($this->purchases as $purchase) {
    //         $data[] = [
    //             'Po.No.',
    //             'Order Date',
    //             'Supplier Name',
    //             'Customer Name',
    //             'Mould',
    //             'Created by', // Add a header for the purchase details section
    //         ];
    
    //         // Add purchase details to the data array
    //         $purchaseDetails = [
    //             'Po.No.' => $purchase->srno,
    //             'Order Date' => Carbon::createFromFormat('Y-m-d', $purchase->odate)->format('d/m/Y'),
    //             'Supplier Name' => $purchase->vendor->customername,
    //             'Customer Name' => $purchase->customer->customername,
    //             'Mould' => $purchase->projectid,
    //             'Created by'=> $purchase->created_by,
    //         ];
    
    //         // Add purchase details row
    //         $data[] = $purchaseDetails;
    //         $data[] = [
    //             null, 
    //             'Plate Name',
    //             'Material',
    //             'Material Type',
    //             'Qty', // Add a header for the purchase items section
    //         ];
    //         // Loop through purchase items and add them to the data array
    //         foreach ($purchase->purchaseItems as $purchaseItem) {
    //             $data[] = [
    //                 null,
    //                 'Plate Name' => $purchaseItem->subplate->platename,
    //                 'Material' => $purchaseItem->material,
    //                 'Material Type' => $purchaseItem->materialtype,
    //                 'Qty' => $purchaseItem->qty,
    //             ];
    //         }
    //     }
    
    //     return collect($data);
    // }
    
    
}
