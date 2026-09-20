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
use PhpOffice\PhpSpreadsheet\Worksheet\PageSetup;

class ExportDispatchChallan implements FromCollection,WithEvents
{
    /**
    * @return \Illuminate\Support\Collection
    */
    protected $dispatch;

    public function __construct(Collection $dispatch)
    {
        $this->dispatch = $dispatch;
    }
    public function collection()
    {
       
        $data = [];
        $data[] = [
            'Dispatch No',
            'Date',
            'Customer Name',
            'Transporter Name',
            'Invoice No.',
            'Vehicle No.',
            'Delivery Type',
        ];
        $data[] = [
            null, 
            'Plate Name',
            'Mould',
            'Description',
            'Particulars',
            'Condition',
            'Work',
            'Qty',
        ];
        $data[] = ['', '', '', '', '', ''];
        $blankRow = ['', '', '', '', '', ''];
       
        foreach ($this->dispatch as $dispatch) {
            // Add purchase details to the data array
            $purchaseDetails = [
                'Dispatch No' => $dispatch->challanno,
                'Date' => Carbon::createFromFormat('Y-m-d', $dispatch->chdate)->format('d/m/Y'),
                'Customer Name' => optional($dispatch->customers)->customername ?? '',
                'Transporter Name' => $dispatch->transporter->customername,
                'Invoice No.' => $dispatch->invoiceno ?? '',
                'Vehicle No.' => $dispatch->vehicleno ?? '',
                'Delivery Type' => $dispatch->deliverytype ?? '',
            ];
          
            // Add purchase details row
            $data[] = $purchaseDetails;
            // Loop through purchase items and add them to the data array
            if (!empty($dispatch->dispatchItems)) {
                foreach ($dispatch->dispatchItems as $dispatchItem) {
                    $data[] = [
                        null,
                        'Plate Name' => optional($dispatchItem->subplate)->platename ?? '',
                        'Mould' => $dispatchItem->project,
                        'Description' => optional($dispatchItem->scanning)->description ?? '',
                        'Particulars' => $dispatchItem->particulars,
                        'Condition' => $dispatchItem->condition,
                        'Work' => $dispatchItem->work,
                        'Qty' => $dispatchItem->qty,
                    ];
                }
            }
            array_push($data, $blankRow);
        }
       
        return collect($data);
    }
    
    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event)
             {

                // 1. Landscape + Minimal Margin
                $sheet = $event->sheet->getDelegate(); // ✅ define $sheet first

                $sheet->getPageSetup()->setOrientation(PageSetup::ORIENTATION_LANDSCAPE);

                $sheet->getPageMargins()->setTop(0.2);
                $sheet->getPageMargins()->setBottom(0.2);
                $sheet->getPageMargins()->setLeft(0.2);
                $sheet->getPageMargins()->setRight(0.2);

                $sheet = $event->sheet->getDelegate();
                $columnWidths = [
                    'A' => 12,
                    'B' => 25,
                    'C' => 20,
                    'D' => 25,
                    'E' => 25,
                    'F' => 20,
                    'G' => 20,
                    'H' => 12,
                    'I' => 5, 
                   
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
