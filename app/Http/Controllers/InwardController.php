<?php

namespace App\Http\Controllers;

use App\Models\ChallanModel;
use App\Models\ChallanItemsModel;
use App\Models\InwardItemsModel;
use App\Models\InwardModel;
use App\Models\CustomerModel;
use App\Models\SubplateModel;
use App\Models\ScanningModel;
use App\Models\ViewModel;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Yajra\DataTables\DataTables as DataTables;

class InwardController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index(Request $request)
    {
        //
        $challandata = ViewModel::select('id','challanno')->where('pending_qty','!=', 0)->groupBy('id','challanno')->get();
        $currentDateTime = Carbon::now()->format('d/m/Y');
        $data = CustomerModel::latest()->where('usertype','Vendor')->get();
        $datacus = CustomerModel::latest()->where('usertype','Customer')->get();
        $datavendor = CustomerModel::latest()->where('usertype','Transport')->get();
     //   $chdata = SubplateModel::select('id','platename')->get();
        return view('inward.index',["currentDateTime"=>$currentDateTime,"data"=>$data,"challandata"=>$challandata, "datavendor"=>$datavendor,"datacus"=>$datacus]);
        
    }
    public function indexmobile(Request $request)
    {
        $data = InwardModel::leftJoin('customers', 'inward.customerid', '=', 'customers.id')
        ->leftJoin('customers AS vendor', 'inward.vendorid', '=', 'vendor.id')
        ->leftJoin('customers AS transporter', 'inward.vendortid', '=', 'transporter.id')
        ->leftJoin('challan', 'inward.challanid', '=', 'challan.id')
        ->select('inward.*', 'customers.customername', 'vendor.customername AS vendorname','transporter.customername AS transportername','challan.challanno as challanno')
        ->where('inward.status', '1')
        ->get();

        return response()->json(['status'=>true,'data' => $data], 200);
    }
    public function printlist1(Request $request)
    {
        //$cdata = InwardModel::leftJoin('customers', 'inchallanid.vendorid', '=', 'customers.id')->select('inchallanid.*','customers.customername','customers.mobile','customers.mobile1')->where('status','1')->where('inchallanid.id',$request->inchallanid)->get();
        $cdata = InwardModel::leftJoin('customers', 'inchallanid.vendorid', '=', 'customers.id')
        ->leftJoin('inchallanid_items', 'inward.id', '=', 'inward_items.inchallanid')
        ->leftJoin('subplate', 'inward_items.plateid', '=', 'subplate.id')
        ->select('inward.*', 'customers.customername', 'customers.mobile', 'customers.mobile1', 'subplate.platename', 'inward_items.plateid')
        ->where('status', '1')
        ->where('inward.id', $request->challan)
        ->get();

        // $cdata = InwardModel::leftJoin('customers', 'challan.vendorid', '=', 'customers.id')
        // ->leftJoin('inward_items', 'challan.id', '=', 'inward_items.challan_id')
       
        // ->select('challan.*', 'customers.customername', 'customers.mobile', 'customers.mobile1', 'subplate.platename')
        // ->where('status', '1')
        // ->where('challan.id', $request->challan)
        // ->get();
        foreach ($cdata as $challan) {
            $carbonDate = Carbon::createFromFormat('Y-m-d', $challan->chdate);
            $formattedDate = $carbonDate->format('d/m/Y');
            $formattedDates[] = $formattedDate;
        }
       
        // $cdata = InwardModel::where('status','1')->get();
        return view('inward.printlist',["request"=>$request,"cdata"=>$cdata,"formattedDate"=>$formattedDate]);
    }
    public function getData(Request $request)
    {
        if ($request->ajax()) {
            // $data = InwardModel::where('status','1')->get();
            $data = InwardModel::where('status','1')->get();
            // $data = UserModel::latest()->get();
            // DB::table('users')->where('name', 'John')->first();
            return DataTables::of($data)
            ->addIndexColumn()  
            // ->rawColumns(['scan_by'])
            ->addColumn('chdate',function($row){
                return [
                    'display' => Carbon::parse($row->chdate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->chdate)->timestamp,
                ];
                //return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            ->addColumn('customerid',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->customerid)->get();
                $customerid="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $customerid=$value->customername;
                    }  
                }
                return $customerid;
            }) 
            ->addColumn('vendorid',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->vendorid)->get();
                $vendorid="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $vendorid=$value->customername;
                    }  
                }
                return $vendorid;
            }) 
            ->addColumn('vendortid',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->vendortid)->get();
                $vendortid="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $vendortid=$value->customername;
                    }  
                }
                return $vendortid;
            }) 
            ->addColumn('challanid',function($row){
                $data1 = ChallanModel::latest()->where("id",$row->challanid)->get();
                $challanid="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $challanid=$value->challanno;
                    }  
                }
                return $challanid;
            }) 
            ->addColumn('action', function($row){
                
                $chdate = Carbon::parse($row->chdate);
                $row->chdate=$chdate->format('d/m/Y');
                // $btn = '<a href="javascript:Edit(\''.(str_replace("\"","\\'",json_encode($row,true))).'\')" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;">Edit</a>';
                   $btn = '<a href="javascript:AskToDelete(\''.$row->id.'\')" class="btn btn-outline-danger waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;">Delete</a>';
                   $btn.= '<a href="'.route("challan3",['inward'=>$row->id]).'" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;" target="_blank">View</a>';
             
                   return $btn;
            })
            ->rawColumns(['action'])
            ->make(true);
          //  return $data;                          
        }
    }
    public function getchallanData(Request $request)
    {
        if ($request->ajax()) {
            $data = ChallanModel::where('status','1')->where('id',$request->challanno)->get();
            // $data = UserModel::latest()->get();
            // DB::table('users')->where('name', 'John')->first();
            return DataTables::of($data)
            ->addIndexColumn()  
            // ->rawColumns(['scan_by'])
            ->addColumn('chdate',function($row){
                return [
                    'display' => Carbon::parse($row->chdate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->chdate)->timestamp,
                ];
                //return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            ->addColumn('vendorid',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->vendorid)->get();
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
                
                $chdate = Carbon::parse($row->chdate);
                $row->chdate=$chdate->format('d/m/Y');
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
    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function getowmainchallandatamobile(Request $request){
        $data = ChallanModel::leftJoin('customers', 'challan.vendorid', '=', 'customers.id')
        ->select('challan.*', 'customers.customername AS vendorname')
        ->where('challan.id','=',$request->challanno)
        ->get();
        // return $data;
         return response()->json(["data" => $data]);
    }
    public function getowmainchallandata(Request $request){
        $data = ChallanModel::leftJoin('customers', 'challan.vendorid', '=', 'customers.id')
        ->select('challan.*', 'customers.customername AS vendorname')
        ->where('challan.id','=',$request->challanno)
        ->get();
        // return $data;
         return response()->json($data);
    }
    public function getowchallandata(Request $request){
        $data = ChallanModel::leftJoin('challan_items', 'challan.id', '=', 'challan_items.challanid')
        ->select('challan.*', 'challan_items.*')
        ->where('challan.id','=',$request->challanno)
        ->get();
        return response()->json($data);
    }
    public function getIitems(Request $request){
        //write a code to get subplates from projectid 
        // $plates = InwardItemsModel::where('challanid','=',$request->challanid)->get();
        // return response()->json($plates);

        $plateData = InwardItemsModel::leftJoin('subplate', 'inward_items.plateid', '=', 'subplate.id')
        ->leftJoin('customers', 'inward_items.customer', '=', 'customers.id')
        ->select('inward_items.*', 'subplate.platename','customers.customername')
        ->where('inchallanid','=',$request->inchallanid)
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
        'platenames' => $platenames
    ]);
  
    }
    public function getIchallanitems(Request $request){
        //write a code to get subplates from projectid 
        // $plates = InwardItemsModel::where('challanid','=',$request->challanid)->get();
        // return response()->json($plates);
        $viewdata = ViewModel::where('id','=',$request->inchallanid)
        // ->groupby('view_pending_inward_qty.id')
        ->get();
        $plateData = ChallanItemsModel::leftJoin('subplate', 'challan_items.plateid', '=', 'subplate.id')
        ->select('challan_items.*', 'subplate.platename')
        ->where('challanid','=',$request->inchallanid)
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
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function addinward(Request $request)
    {
        try
        {
            if($request->id!=""){
                $model=InwardModel::findOrFail($request->id);
                $model->chdate = Carbon::createFromFormat('d/m/Y', $request->input('chdate'))->format('Y-m-d');
                $model->customerid = $request->input('customerid');
                $model->vendorid = $request->input('vendorid');
                $model->vendortid = $request->input('vendortid');
                $model->projectid = $request->input('projectid');
                $model->save();
                return response()->json(['status'=>true,'message'=>"Data updated successfully"], 200);
               }
               else{
                        $model=new InwardModel();
                        $model->chdate = Carbon::createFromFormat('d/m/Y', $request->input('chdate'))->format('Y-m-d');
                        $model->customerid = $request->input('customerid');
                        $model->vendorid = $request->input('vendorid');
                        $model->vendortid = $request->input('vendortid');
                        $model->projectid = $request->input('projectid');
                        $model->challanid = $request->input('challanno');
                        $datac = InwardModel::select('*')->get();
                        //dd($datac);
                        $inchallanid=$datac->count()+1;
                        if ($inchallanid < 10) {
                            $model->inchallanno="SM/IW/0".$inchallanid;
                        } else {
                            $model->inchallanno="SM/IW/".$inchallanid;
                        }
                        $model->save();
                        return response()->json(['status'=>true,'message'=>"Data inserted successfully "], 200);
                    }
        }
        catch(\Illuminate\Database\QueryException $ex)
       { 
           $error="Something went wrong. Try after sometime.";
           foreach ($ex->getPrevious()->errorInfo as $key => $value) {
               # code...
               if(strlen($value)>7){
                   $error=$value;
               }
           }
               return response()->json(['status'=>false,'message' => $error], 200);
               // Note any method of class PDOException can be called on $ex.
       }
    }
  

//     public function store(Request $request)
// {
     
//     // Create a new Challan model and populate its attributes
//     $challan = new InwardModel();
//     $challan->chdate = Carbon::createFromFormat('d/m/Y', $request->input('chdate'))->format('Y-m-d');
//     $challan->vendorid = $request->input('vendorid');
//     $challan->projectid = $request->input('projectid');
//    // $challan->vendorid = $request->input('vendorid');
//     $datac = InwardModel::select('*')->get();
//     $challnid=$datac->count()+1;
//     $challan->challanno="OW_".$challnid;
//     // $challan->cdescription = $request->input('cdescription');
//     // $challan->particulars = $request->input('particulars');
//   //  $challan->qty = $request->input('qty');

//     // Save the Challan model to the database
//     $challan->save();

//     // Process the categories
//     $categoryIds = $request->input('categories', []);
//     $descriptions = $request->input('cdescription', []);
//     $particulars = $request->input('particulars', []);
//     $qtys = $request->input('qty', []);
//     // foreach ($categoryIds as $categoryId) {
//     //     $challan->categories()->attach($challan->id, [
//     //         'particulars' => $request->input('particulars'),
//     //         'cdescription' => $request->input('cdescription'),
//     //         'plateid' => $categoryId,
//     //         'challanid'=>$challan->id
//     //     ]);
//     //     //$challan->categories()->attach($challan->id, ['plateid' => $categoryId,'challanid'=>$challan->id]);
//     // }


//     if ((count($categoryIds) == count($descriptions)) && (count($categoryIds) == count($particulars)) && (count($categoryIds) == count($qtys))) {
//         foreach ($categoryIds as $index => $categoryId) {
//             $description = $descriptions[$index]; // Get the corresponding description
//             $particular = $particulars[$index];
//             $qty = $qtys[$index];
//             $challan->categories()->attach($categoryId, [
//                 'particulars' => $particular,
//                 'cdescription' => $description,
//                 'qty' => $qty,
//                 'challanid'=>$challan->id,
//             ]);
//         }
//     } else {
//         // Handle the case where the number of categories and descriptions do not match
//         // This could indicate an issue with the input data
//         return redirect()->back()->with('error', 'Number of categories and descriptions do not match.');
//     }
    

//     // if (count($categoryIds) === count($descriptions)) {
//     //     foreach ($categoryIds as $index => $categoryId) {
//     //         $description = $descriptions[$index]; // Get the corresponding description

//     //         $challan->categories()->attach($challan->id, [
//     //             'particulars' => $request->input('particulars'),
//     //             'cdescription' => $description,
//     //             'plateid' => $categoryId,
//     //             'challanid'=>$challan->id
//     //         ]);
//     //     }
//     // } else {
//     //     // Handle the case where the number of categories and descriptions do not match
//     //     // This could indicate an issue with the input data
//     //     return redirect()->back()->with('error', 'Number of categories and descriptions do not match.');
//     // }
//     // Optionally, you can redirect the user to a success page or show a success message
//     return redirect()->back()->with('success', 'Challan created successfully!');
// }

public function store(Request $request)
{
    //  dd($request);
    if ($request->id != "") {
        // Find the existing Challan model
        $challan = InwardModel::findOrFail($request->id);
    
        // Update the Challan attributes
        $challan->chdate = Carbon::createFromFormat('d/m/Y', $request->input('chdate'))->format('Y-m-d');
        // $challan->customerid = $request->input('customerid');
        $challan->vendorid = $request->input('vendorid');
        $challan->vendortid = $request->input('vendortid');
        $challan->projectid = $request->input('projectid');
    
        // Save the updated Challan model to the database
        $challan->save();
    
        // Process the updated categories
    
        $pids = $request->input('pids', []);
        $inchallanid = $request->input('inchallanid', []);
        
        $categoryIds = $request->input('categories', []);
        // $descriptions = $request->input('cdescription', []);
        $particulars = $request->input('particulars', []);
        $qtys = $request->input('qty', []);
        $inqtys = $request->input('inward_qty', []);
    
        // Iterate over each row in the repeater
        if ((count($categoryIds) == count($particulars)) && (count($categoryIds) == count($qtys))) {
        foreach ($pids as $index => $pid) {
            if ($pid != "" && $pid!=null) {
                $category = InwardItemsModel::find($pid);
                
                if ($category) {
                    // Update the existing category
                    $category->plateid = $categoryIds[$index];
                    // $category->cdescription = $descriptions[$index];
                    $category->particulars = $particulars[$index];
                    $category->qty = $qtys[$index];
                    $category->inward_qty = $inqtys[$index];
                    $category->save();
                } 
            } else {
                // Create a new category
                $newCategory = new InwardItemsModel();
                $newCategory->plateid = $categoryIds[$index];
                $newCategory->inchallanid = $inchallanid[$index];
                // $newCategory->cdescription = $descriptions[$index];
                $newCategory->particulars = $particulars[$index];
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
    $challan = new InwardModel();
    $challan->chdate = Carbon::createFromFormat('d/m/Y', $request->input('chdate'))->format('Y-m-d');
    // $challan->customerid = $request->input('customerid');
    $challan->vendorid = $request->input('vendorid');
    $challan->vendortid = $request->input('vendortid');
    $challan->projectid = $request->input('projectid');
    $challan->challanid = $request->input('challanno');
   // $challan->vendorid = $request->input('vendorid');.
    $datac = InwardModel::select('*')->get();
    //dd($datac);
    $inchallanid=$datac->count()+1;
    if ($inchallanid < 10) {
        $challan->inchallanno="SM/IW/0".$inchallanid;
    } else {
        $challan->inchallanno="SM/IW/".$inchallanid;
    }
    
    // $challan->cdescription = $request->input('cdescription');
    // $challan->particulars = $request->input('particulars');
  //  $challan->qty = $request->input('qty');

    // Save the Challan model to the database
    $challan->save();

    // Process the categories
    $categoryIds = $request->input('categories', []);
    $customers = $request->input('customer', []);
    $projects = $request->input('project', []);
    $particulars = $request->input('particulars', []);
    // dd($particulars);
    $qtys = $request->input('qty', []);
    $inqtys = $request->input('inward_qty', []);
    
    //dd($inqtys);
    // foreach ($categoryIds as $categoryId) {
    //     $challan->categories()->attach($challan->id, [
    //         'particulars' => $request->input('particulars'),
    //         'cdescription' => $request->input('cdescription'),
    //         'plateid' => $categoryId,
    //         'challanid'=>$challan->id
    //     ]);
    //     //$challan->categories()->attach($challan->id, ['plateid' => $categoryId,'challanid'=>$challan->id]);
    // }


    if ((count($categoryIds) == count($particulars)) && (count($categoryIds) == count($qtys))  && (count($categoryIds) == count($inqtys)) && (count($categoryIds) == count($customers))) {
        foreach ($categoryIds as $index => $categoryId) {
            // $description = $descriptions[$index]; // Get the corresponding description
            $particular = $particulars[$index];
            $qty = $qtys[$index];
            $inward_qty = $inqtys[$index];
            $customer = $customers[$index];
            $project = $projects[$index];
            // dd($inward_qty);
            $challan->categories()->attach($categoryId, [
                'particulars' => $particular,
                'customer' => $customer,
                'project' => $project,
                'qty' => $qty,
                'inward_qty' => ($inward_qty==Null || $inward_qty=="")?0:$inward_qty,
                // 'pending_qty' => $pqty,
                'inchallanid'=>$challan->id,
                'challanid' => $challan->challanid,
            ]);
            // if ($qty != 0 && $qty != "") 
            //     {
            //         // Update location in ScanModel
            //         $scanModel = SubplateModel::where('id', $categoryId)
            //                               ->first();
            //         if ($scanModel) {
            //             // Update the location
            //             // $sc = CustomerModel::select('initials')->where('id', $challan->vendorid)->first();
            //             $scanModel->location = 'SM'; 
            //             $scanModel->save();
            //         }
            //     }
            $pqty = ViewModel::where('plateid', $categoryId)
            ->selectRaw('SUM(pending_qty) as total_pending_qty')
            ->value('total_pending_qty');
           
            // $pqty = ViewModel::where('plateid', $categoryId)->groupBy('plateid')->count();
            if ($pqty == 0) {
                // Update location in ScanModel
                $scanModel = SubplateModel::where('id', $categoryId)->first();
                if ($scanModel) {
                    $sc = CustomerModel::select('initials')->where('id', $challan->vendorid)->first();
                    // Convert the location string to an array of initials
                    $existingInitials = explode(',', $scanModel->location);
            
                    // Check if $sc->initials is present in the array
                    $scInitialsFound = in_array($sc->initials, $existingInitials);
            
                    if ($scInitialsFound) {
                        // If $sc->initials is present, update the location to 'SM'
                        $scanModel->location = 'SM';
                    } else {
                        // If $sc->initials is not present, add it to the array
                        $scanModel->location = 'SM';
                        // Update the location to the imploded initials
                        $scanModel->location = implode(',', $existingInitials);
                    }
            
                    $scanModel->save();
                }
            }
            // else {
            //     $scanModel = SubplateModel::where('id', $categoryId)->first();
            //     if ($scanModel) {
            //         $sc = CustomerModel::select('initials')->where('id', $challan->vendorid)->first();
            //         // Convert the location string to an array of initials
            //         $existingInitials = explode(',', $scanModel->location);
                        
            //         // Check if $sc->initials is present in the array
            //         $scInitialsFound = in_array($sc->initials, $existingInitials);
                        
            //         if ($scInitialsFound) {
            //             // If $sc->initials is present, remove it from the array
            //             $existingInitials = array_diff($existingInitials, [$sc->initials]);
            //         } else {
            //             // If $sc->initials is not present, add it to the array
            //             $existingInitials[] = $sc->initials;
            //         }
                        
            //         // Update the location to the imploded initials
            //         $scanModel->location = implode(',', $existingInitials);
            //         $scanModel->save();
            //     }
            // }
            
            else {
                $pqtyv = ViewModel::where('plateid', $categoryId)->where('vendorid', $challan->vendorid)
                ->selectRaw('SUM(pending_qty) as total_pending_qty')
                ->value('total_pending_qty');
                            
                $scanModel = SubplateModel::where('id', $categoryId)->first();
                if($pqtyv == 0){
                    if ($scanModel) {
                                $sc = CustomerModel::select('initials')->where('id', $challan->vendorid)->first();
                                // Convert the location string to an array of initials
                                $existingInitials = explode(',', $scanModel->location);
                                    
                                // Check if $sc->initials is present in the array
                                $scInitialsFound = in_array($sc->initials, $existingInitials);
                                    
                                if ($scInitialsFound) {
                                    // If $sc->initials is present, remove it from the array
                                    $existingInitials = array_diff($existingInitials, [$sc->initials]);
                                }    
                                // Update the location to the imploded initials
                                $scanModel->location = implode(',', $existingInitials);
                                $scanModel->save();
                            }
                } 
                else{
                    if ($scanModel) {
                        $sc = CustomerModel::select('initials')->where('id', $challan->vendorid)->first();
                        // Convert the location string to an array of initials
                        $existingInitials = explode(',', $scanModel->location);
                            
                        // Check if $sc->initials is present in the array
                        $scInitialsFound = in_array($sc->initials, $existingInitials);
                            
                        if (!$scInitialsFound) {
                            // If $sc->initials is not present, add it to the array
                            $existingInitials[] = $sc->initials;
                        }
                            
                        // Update the location to the imploded initials
                        $scanModel->location = implode(',', $existingInitials);
                        $scanModel->save();
                    }
                }  
            }
        }
    } else {
        // Handle the case where the number of categories and descriptions do not match
        // This could indicate an issue with the input data
        return redirect()->back()->with('error', 'Number of categories and descriptions do not match.');
    }
    
    }
            // if ($categoryId != "") {
            //     // Update the existing category
            //     $challan->categories()->updateExistingPivot($categoryId, [
            //         'cdescription' => $description,
            //         'particulars' => $particular,
            //         'qty' => $qty,
            //     ]);
            //} 
            // else {
            //     // Add a new category
            //     $category = new CategoryModel([
            //         'cdescription' => $description,
            //         'particulars' => $particular,
            //         'qty' => $qty,
            //     ]);
    
            //     // Save the category and attach it to the Challan model
            //     $challan->categories()->save($category, ['pid' => $pid]);
            // }
       
    return redirect()->back()->with('success', 'Challan created/updated successfully!');
}


    // public function store(Request $request)
    // {
    //     //
    //     if($request->id!=""){
    //         $model=InwardModel::findOrFail($request->id);
    //         $model->chdate=Carbon::createFromFormat('d/m/Y', $request->chdate)->format('Y-m-d');
    //         $model->vendorid=$request->vendorid;
    //         $model->cdescription=$request->cdescription;
    //         $model->particulars=$request->particulars;
    //         $model->qty=$request->qty;
    //         $model->save();
    //        }
    //        else{
    //                 $model=new InwardModel();
    //                 $model->chdate=Carbon::createFromFormat('d/m/Y', $request->chdate)->format('Y-m-d');
    //                 $model->vendorid=$request->vendorid;
    //                 $model->cdescription=$request->cdescription;
    //                 $model->particulars=$request->particulars;
    //                 $model->qty=$request->qty;
    //                 $model->save();
    //             }
    //             return redirect(route('challanlist'));
    // }
    /**
     * Display the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function show($id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function edit($id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        //
        
        $model=InwardModel::where("id", $id)->update(["status" => "0"]);
      
        return redirect(route('inwardlist'));
    }
    public function deleteinward(Request $request)
    {
        //
        try
        {   
            $model=InwardModel::where("id", $request->id)->update(["status" => "0"]);
            return response()->json(['status'=>true,'message' => "Inward Challan deleted successfully."], 200);
       } 
       catch(\Illuminate\Database\QueryException $ex)
       { 
           $error="Something went wrong. Try after sometime.";
           foreach ($ex->getPrevious()->errorInfo as $key => $value) {
               # code...
               if(strlen($value)>7){
                   $error=$value;
               }
           }
               return response()->json(['status'=>false,'message' => $error], 200);
               // Note any method of class PDOException can be called on $ex.
       } 
    }
}
