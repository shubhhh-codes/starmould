<?php
namespace App\Http\Controllers;

use App\Models\PurchaseModel;
use App\Models\ViewPurchaseModel;
use App\Exports\ExportPurchase;
use App\Exports\ExportMould;
use App\Exports\ExportMouldreg;
use App\Exports\ExportOutward;
use App\Exports\ExportPurchaserec;
use App\Models\ScanningModel;
use App\Models\ChallanModel;
use App\Models\ViewModel;
use App\Exports\ExportPendingoutward;
use App\Models\DispatchModel;
use App\Exports\ExportDispatchChallan; 

use Maatwebsite\Excel\Facades\Excel;


class ExportController extends Controller
{
    public function export()
    {
        $purchases  = PurchaseModel::with('purchaseItems','customer')->where('status', '1')->orderBy('created_at', 'desc')->get();
        return Excel::download(new ExportPurchase($purchases), 'purchase.xlsx');
    }
    public function exportmould()
    {
        $moulds = ScanningModel::with('subPlates')->where("worktype","<>","Sample")->where("status","pending")->orderBy('created_at', 'desc')->get();
        return Excel::download(new ExportMould($moulds), 'dashboard.xlsx');
    }
    public function exportmouldreg()
    {
        $mouldsreg = ScanningModel::with(['subPlates','customer'])->where("worktype","<>","Sample")->where("status","registered")->orderBy('created_at', 'desc')->get();
        
        return Excel::download(new ExportMouldreg($mouldsreg), 'project register.xlsx');
    }
    public function exportpurchaserec()
    {
        $purchasesrec = ViewPurchaseModel::with('purchaseinwardItems','customer')->where('pending_qty','!=', 0)->groupBy('id')->orderBy('id', 'desc')->get(); 
        // $purchasesrec  = PurchaseModel::with('purchaseinwardItems','customer')->where('status', '1')->orderBy('created_at', 'desc')->get();
        return Excel::download(new ExportPurchaserec($purchasesrec), 'pending purchase receive.xlsx');
    }
    public function exportoutward()
    {
        $outwards  = ChallanModel::with('outwardItems')->where('status','1')->orderBy('id', 'desc')->get(); 
        return Excel::download(new ExportOutward($outwards), 'outward.xlsx');
    }
    public function exportdispatchchallan()
    {
        $dispatch  = DispatchModel::with('outwardItems')->where('status','1')->orderBy('id', 'desc')->get(); 
        return Excel::download(new ExportDispatchChallan($dispatch), 'DispatchChallan.xlsx');
    }
    public function exportpendingoutward()
    {
        
        $pendingoutwards = ViewModel::with('pendingoutwardItems','customer')->where('pending_qty','!=', 0)->groupBy('id')->orderBy('id', 'desc')->get();
        // $pendingoutwards  = ChallanModel::with('outwardItems')->where('status','1')->orderBy('id', 'desc')->get(); 
        return Excel::download(new ExportPendingoutward($pendingoutwards), 'pending outward.xlsx');
    }
    
}