<?php

namespace App\Http\Controllers;


use App\Models\ChallanModel;
use App\Models\ChallanItemsModel;
use App\Models\InwardItemsModel;
use App\Models\InwardModel;
use App\Models\CustomerModel;
use App\Models\PurchaseInwardModel;
use App\Models\PurchaseItemsModel;
use App\Models\PurchaseModel;
use App\Models\SubplateModel;
use App\Models\ScanningModel;
use App\Models\ViewModel;
use App\Models\ViewPurchaseModel;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Yajra\DataTables\DataTables as DataTables;

class PurchaseInwardController extends Controller
{
    //
    public function index(){
        return view('purchaseinward.index');
    }
    public function store(Request $request)
{
    //dd($request);
    if ($request->id != "") {
        // Find the existing Challan model
        $purchase = PurchaseInwardModel::findOrFail($request->id);
    
        // Update the Challan attributes
        $purchase->odate = Carbon::createFromFormat('d/m/Y', $request->input('odate'))->format('Y-m-d');
        $purchase->cname = $request->input('cname');
        $purchase->vname = $request->input('vname');
        $purchase->projectid = $request->input('projectid');
    
        // Save the updated Challan model to the database
        $purchase->save();
    
        // Process the updated categories
    
        $pids = $request->input('pids', []);
        $inpid = $request->input('inpid', []);
        
        $categoryIds = $request->input('categories', []);
        $materialtypes = $request->input('materialtype', []);
        $imaterials = $request->input('imaterial', []);
        $materials = $request->input('material', []);
        $qtys = $request->input('qty', []);
        $inqtys = $request->input('inward_qty', []);
    
        // Iterate over each row in the repeater
        if ((count($categoryIds) == count($materialtypes)) && (count($categoryIds) == count($materials)) && (count($categoryIds) == count($qtys))) {
        foreach ($pids as $index => $pid) {
            if ($pid != "" && $pid!=null) {
                $category = InwardItemsModel::find($pid);
                
                if ($category) {
                    // Update the existing category
                    $category->plateid = $categoryIds[$index];
                    $category->materialtype = $materialtypes[$index];
                    $category->material = $materials[$index];
                    $category->imaterial = $imaterials[$index];
                    $category->qty = $qtys[$index];
                    $category->inward_qty = $inqtys[$index];
                    $category->save();
                } 
            } else {
                // Create a new category
                $newCategory = new InwardItemsModel();
                $newCategory->plateid = $categoryIds[$index];
                $newCategory->inpid = $inpid[$index];
                $newCategory->materialtype = $materialtypes[$index];
                $newCategory->material = $materials[$index];
                $newCategory->imaterial = $imaterials[$index];
                $newCategory->qty = $qtys[$index];
                $newCategory->inward_qty = $inqtys[$index];
                $newCategory->save();
            }
           // else{

           // }
           }
        }  
    } else {
                // Create a new Challan model and populate its attributes
    $purchase = new PurchaseInwardModel();
    $purchase->odate = Carbon::createFromFormat('d/m/Y', $request->input('odate'))->format('Y-m-d');
    $purchase->cname = $request->input('customerid');
    $purchase->vname = $request->input('vendorid');
    $purchase->projectid = $request->input('projectid');
    $purchase->pid = $request->input('srno');
    $purchase->inpono = $request->input('inpono');
   // $challan->vendorid = $request->input('vendorid');.
    $datac = PurchaseInwardModel::select('*')->get();
    //dd($datac);
    $inpid=$datac->count()+1;
    if ($inpid < 10) {
        $purchase->insrno="SM/PR/0".$inpid;
    } else {
        $purchase->insrno="SM/PR/".$inpid;
    }
    // Save the Challan model to the database
    $purchase->save();
    // Process the categories
    $categoryIds = $request->input('categories', []); 
    $imaterials = $request->input('imaterial', []);
    $materials = $request->input('material', []);
    $materialtypes = $request->input('materialtype', []);
    $qtys = $request->input('qty', []);
    $inqtys = $request->input('inward_qty', []);
    if ((count($categoryIds) == count($materials)) && (count($categoryIds) == count($materialtypes)) && (count($categoryIds) == count($qtys))  && (count($categoryIds) == count($inqtys))) {
        foreach ($categoryIds as $index => $categoryId) {
            // $description = $descriptions[$index]; // Get the corresponding description
            $material = $materials[$index];
            $materialtype = $materialtypes[$index];
            $qty = $qtys[$index];
            $imaterial = $imaterials[$index];
            $inward_qty = $inqtys[$index];
            // $pqty = $pqtys[$index];
            // dd($inward_qty);
            $purchase->categories()->attach($categoryId, [
                'imaterial' => $imaterial,
                'material' => $material,
                'materialtype' => $materialtype,
                'qty' => $qty,
                'inward_qty' => ($inward_qty==Null || $inward_qty=="")?0:$inward_qty,
                // 'pending_qty' => $pqty,
                'inpid'=>$purchase->id,
                'pid' => $purchase->pid,
            ]); 
        }
    } else {
        // Handle the case where the number of categories and descriptions do not match
        // This could indicate an issue with the input data
        return redirect()->back()->with('error', 'Number of categories and descriptions do not match.');
    }
    
    }   
    return redirect()->back()->with('success', 'Purchase created/updated successfully!');
}
public function getpurchaseData(Request $request)
    {
        if ($request->ajax()) {
            $data = PurchaseModel::where('status','1')->where('id',$request->id)->get();
            // $data = UserModel::latest()->get();
            // DB::table('users')->where('name', 'John')->first();
            return DataTables::of($data)
            ->addIndexColumn()  
            // ->rawColumns(['scan_by'])
            ->addColumn('odate',function($row){
                return [
                    'display' => Carbon::parse($row->odate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->odate)->timestamp,
                ];
                //return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            ->addColumn('vname',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->vname)->get();
                $vendorid="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $vendorid=$value->customername;
                    }  
                }
                return $vendorid;
            }) 
            ->addColumn('action', function($row){
                
                $odate = Carbon::parse($row->odate);
                $row->odate=$odate->format('d/m/Y');
                $btn = '<a href="javascript:Edit(\''.(str_replace("\"","\\'",json_encode($row,true))).'\')" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;">Edit</a>';
                   $btn .= '<a href="javascript:AskToDelete(\''.$row->id.'\')" class="btn btn-outline-danger waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;">Delete</a>';
                   $btn.= '<a href="'.route("challan2",['challan'=>$row->id]).'" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;" target="_blank">View</a>';
             
                   return $btn;
            })
            ->rawColumns(['action'])
            ->make(true);
          //  return $data;                          
        }
    }
public function getIpurchaseitems(Request $request){
        //write a code to get subplates from projectid 
        // $plates = InwardItemsModel::where('challanid','=',$request->challanid)->get();
        // return response()->json($plates);
        $viewdata = ViewPurchaseModel::where('id','=',$request->inpid)
        // ->groupby('view_pending_inward_qty.id')
        ->get();
        $plateData = PurchaseItemsModel::leftJoin('subplate', 'purchase_items.plateid', '=', 'subplate.id')
        ->select('purchase_items.*', 'subplate.platename')
        ->where('pid','=',$request->inpid)
        ->get();

        $platenames  = ScanningModel::join('subplate', 'scan.id', '=', 'subplate.projectid')
        ->select('subplate.id','subplate.platename', 'subplate.subprojectid')
        ->where('scan.projectid', $request->projectid)
        ->get();
    //     $plates = InwardItemsModel::where('challanid', '=', $request->challanid)
    //     ->with('subplate') // eager load the subplate relationship
    //     ->get();
    
    // $plateData = $plates->map(function ($plate) {
    //     return [
    //         'challan_item' => $plate,
    //         'plate_name' => $plate->subplate->platename,
    //     ];
    // });
    
    return response()->json([
        'plateData' => $plateData,
        'platenames' => $platenames,
        'viewdata' => $viewdata
    ]);

        
    }
    public function getowmainpurchasedata(Request $request){
        $data = PurchaseModel::leftJoin('customers', 'purchase.vname', '=', 'customers.id')
        ->select('purchase.*', 'customers.customername AS vendorname')
        ->where('purchase.id','=',$request->id)
        ->get();
        // return $data;
         return response()->json($data);
    }
}
