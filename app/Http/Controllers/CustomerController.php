<?php

namespace App\Http\Controllers;
use Illuminate\Support\Facades\Auth;
use App\Models\ChallanModel;
use App\Models\ChallanViewModel;
use App\Models\PurchaseViewModel;
use App\Models\CustomerModel;
use App\Models\PrintingModel;
use App\Models\ScanningModel;
use App\Models\SubplateModel;
use App\Models\DispatchViewModel;
use App\Models\ViewModel;
use Illuminate\Http\Request;
use Yajra\DataTables\DataTables as DataTables;

class CustomerController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        //
        return view('customer.index');
    }
    public function checkusername(Request $request){
        if($request->id!=""){
            $data = CustomerModel::select('*')->where('customername', $request->username)->where('id','<>', $request->id);
        }else{
            $data = CustomerModel::select('*')->where('customername', $request->username);
        }
        if($data->count()>0){
            $res["success"]=true;
            return $res;
        }
        else{
            $res["success"]=false;
            return $res;
        }
    }
    public function checkinitials(Request $request) {
        $initials = $request->input('initials');
        // Perform a database query to check if the initial exists
        $initialExists = CustomerModel::where('initials', $initials)->exists();
        
        return response()->json(['initialExists' => $initialExists]);
    }
    
    // public function checkinitials(Request $request){
    //     $data = CustomerModel::select('initials')->where('initials', $request->initials);
    //     if ($data->exists()) {
    //         $res["success"] = true;

    //     } else {
    //         $res["success"] = false;
    //     }
    //     // return response()->json($res);
    // }
    public function indexmobile(Request $request)
    {
        try
        {
            $res="";
            if(str_starts_with($request->projectid,"S")){
                $data=ScanningModel::where("projectid",$request->projectid)->where("cname",$request->cid)->get();
                // $res='<option value="">Select Project</option>';
                foreach ($data as $key => $value) {
                    $res=$value;
                    
                }
                return response()->json(['status'=>true,'data'=>$res], 200);
            }
            else{
                $data=PrintingModel::where("projectid",$request->projectid)->where("cname",$request->cid)->get();
            
                foreach ($data as $key => $value) {
                    $res=$value;
                } 
            }
            return response()->json(['status'=>true, 'data'=>$res], 200);
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
    public function getcustomerdata(Request $request){
        $res="";
        if($request->projectid){
            $data =ScanningModel::select('*')->join('subplate as sp', 'sp.projectid', '=', 'scan.id')
            ->where('scan.projectid', $request->projectid)
            ->get();
            // $res='<option value="">Select Project</option>';
            $res = $data;
        }
        return $res;
    }
    
    public function getcustomerdatamobile(Request $request){
        try
        {
            $res="";
            if($request->projectid){
                $data =ScanningModel::select('*')->join('subplate as sp', 'sp.projectid', '=', 'scan.id')
                ->where('scan.projectid', $request->projectid)
                ->get();
                // $res='<option value="">Select Project</option>';
                $res = $data;
            }        return response()->json(['status'=>true, 'data'=>$res], 200);
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
    public function getprojectswork(Request $request){
        $data=ScanningModel::where("cname",$request->cid)->where('status','<>','completed')->where('status','<>','registered')->get();
        $res='<option value="">Select Mould</option>';
        foreach ($data as $key => $value) {
            // $res.='<option value="'.$value->projectid.'">'.$value->projectid.'</option>';
            $res.='<option value="'.$value->projectid.'">'.$value->projectid. '&nbsp;&nbsp;&nbsp;&nbsp;---&nbsp;&nbsp;&nbsp;&nbsp;' .$value->description.'</option>';
        }
        return $res;
    }
    public function getprojectsworkmobile(Request $request){
        try
        {
                $data=ScanningModel::select('projectid')->where("cname",$request->cid)->where('status','<>','completed')->where('status','<>','registered')->get();
                return response()->json(['status'=>true, 'data'=>$data], 200);
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
    public function getprojects(Request $request){
        $data=ScanningModel::where("cname",$request->cid)->where('status','<>','completed')->where('status','<>','registered')->get();
        $res='<option value="">Select Mould</option>';
        foreach ($data as $key => $value) {
            // $res.='<option value="'.$value->projectid.'">'.$value->projectid.'</option>';
            $res.='<option value="'.$value->projectid.'">'.$value->projectid. '&nbsp;&nbsp;&nbsp;&nbsp;---&nbsp;&nbsp;&nbsp;&nbsp;' .$value->description.'</option>';
        }
        return $res;
    }
    public function getprojectsmobile(Request $request){
        try
        {
            
                $data=ScanningModel::select('projectid')->where("cname",$request->cid)->where('status','<>','completed')->get();
                return response()->json(['status'=>true, 'data'=>$data], 200);
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
    public function getcustomermobile(Request $request){
        try
        {
            
            $data = CustomerModel::select('id','customername','usertype')->where('usertype','Customer')->get();
      
                return response()->json(['status'=>true, 'data'=>$data], 200);
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
    public function getaccountmobile(Request $request){
        try
        {
            
            $data = CustomerModel::select('id','customername','usertype')->where('usertype','Other')->get();
      
                return response()->json(['status'=>true, 'data'=>$data], 200);
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
    public function geticustomermobile(Request $request){
        try
        {
            
            $data = ViewModel::select('customerid','customername')->where('vendorid', $request->vid)->where('pending_qty','!=', 0)->groupBy('customerid','customername','vendorid')->get();
      
                return response()->json(['status'=>true, 'data'=>$data], 200);
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
    public function getchallannomobile(Request $request){
        try
        {
            
            $data = ViewModel::select('id','challanno')->where('customerid', $request->cid)->where('vendorid', $request->vid)->where('pending_qty','!=', 0)->groupBy('id','challanno','customerid','vendorid')->get();
                return response()->json(['status'=>true, 'data'=>$data], 200);
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
    public function geticustomer(Request $request){
        $data = ViewModel::select('customerid','customername')->where('vendorid', $request->vid)->where('pending_qty','!=', 0)->groupBy('customerid','customername','vendorid')->get();
        $res='<option value="">Select Customer</option>';
        foreach ($data as $key => $value) {
            $res.='<option value="'.$value->customerid.'">'.$value->customername.'</option>';
        }
        return $res;
    }
    public function getchallanno(Request $request){
        $data = ViewModel::select('id','challanno')->where('customerid', $request->cid)->where('vendorid', $request->vid)->where('pending_qty','!=', 0)->groupBy('id','challanno','customerid','vendorid')->get();
        $res='<option value="">Select Challan No</option>';
        foreach ($data as $key => $value) {
            $res.='<option value="'.$value->id.'">'.$value->challanno.'</option>';
        }
        return $res;
    }
    
    public function getprojectsubplates(Request $request){

        $data  = ScanningModel::join('subplate', 'scan.id', '=', 'subplate.projectid')
        ->select('subplate.id','subplate.platename', 'subplate.subprojectid','subplate.sqty')
        ->where('scan.projectid', $request->projectid)
        ->get();
        //dd($request);
       // $data=SubplateModel::where("projectid",$request->projectid)->get();
        // dd($data);
        // $res='<option value="">Select Sub Project</option>';
        // foreach ($data as $key => $value) {
        //     $res .='<option value="'.$value->id.'">'.$value->platename.'</option>';
        // }
        return response()->json(['status'=>true, 'data'=>$data], 200);
    }
    public function getprojectsubplatesview(Request $request){
        $data  = ChallanViewModel::where('projectname', $request->projectid)->get();
        
        return response()->json(['status'=>true, 'data'=>$data], 200);
    }
    public function getdispatchprojectsubplatesview(Request $request){
        $data  = DispatchViewModel::where('projectname', $request->projectid)->get();
        return response()->json(['status'=>true, 'data'=>$data], 200);
    }
    public function getprojectsubplatespurchaseview(Request $request){
        $data  = PurchaseViewModel::where('projectname', $request->projectid)->get();
        
        return response()->json(['status'=>true, 'data'=>$data], 200);
    }
    public function getprojectsubplatesviewmobile(Request $request){
        try
        {
            $data  = ChallanViewModel::where('projectname', $request->projectid)->get();   
            return response()->json(['status'=>true, 'data'=>$data], 200);
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
    public function getplatedata(Request $request){
        //dd($request);
        $data=SubplateModel::where("projectid",$request->pid)->get();
        // dd($data);
        $res='<option value="">Select Project</option>';
        foreach ($data as $key => $value) {
            $res .='<option value="'.$value->subprojectid.'">'.$value->subprojectid.'</option>';
        }
        return $res;
    }
    public function customerdata(Request $request)
    {
        $data = CustomerModel::latest()->get();
        return response()->json(['status'=>true, 'data'=>$data], 200);
    }
    public function getData(Request $request)
    {
        if ($request->ajax()) {
            //$data = CustomerModel::select('*')->where('role', '1');
             $data = CustomerModel::latest()->get();
            // DB::table('users')->where('name', 'John')->first();
            return DataTables::of($data)
            ->addIndexColumn()  
            // ->rawColumns(['scan_by'])
            ->addColumn('action', function($row){
                $btn = '<a href="javascript:Edit(\''.(str_replace("\"","\\'",json_encode($row,true))).'\',\''.$row->id.'\')" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" >Edit</a>';
                
                   $btn .= '<a href="javascript:AskToDelete(\''.$row->id.'\')" class="btn btn-outline-danger waves-effect waves-light btn-sm">Delete</a>';
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
    public function addcustomer(Request $request)
    {
        try
        {
            $model=new CustomerModel();
        
            $model->customername=$request->customername;
            $model->mobile1=$request->mobile1;
            $model->email=$request->email;
            $model->address=$request->address;
            $model->initials=$request->initials;
            $model->usertype=$request->usertype;
            $model->mobile=$request->mobile;
            $model->save();
            return response()->json(['status'=>true, 'message'=>"Data added successfully"], 200);
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
    public function store(Request $request)
    {
        //
        $model=new CustomerModel();
        
        $model->customername=$request->customername;
        $model->mobile1=$request->mobile1;
        $model->email=$request->email;
        $model->address=$request->address;
        $model->initials=$request->initials;
        $model->usertype=$request->usertype;
        $model->mobile=$request->mobile;
        $model->save();
        return redirect(route('customer.index'));
    }
    public function updatedata(Request $request)
    {
        //
        $model=CustomerModel::findOrFail($request->id);
        
        $model->customername=$request->customername;
        $model->mobile1=$request->mobile1;
        $model->email=$request->email;
        $model->address=$request->address;
        $model->initials=$request->initials;
        $model->usertype=$request->usertype;
        $model->mobile=$request->mobile;
        $model->save();
        return redirect(route('customerlist'));
    }
    public function updatecustomer(Request $request)
    {
        try
        {
            $model=CustomerModel::findOrFail($request->id);
            $model->customername=$request->customername;
            $model->mobile1=$request->mobile1;
            $model->email=$request->email;
            $model->address=$request->address;
            $model->initials=$request->initials;
            $model->usertype=$request->usertype;
            $model->mobile=$request->mobile;
            $model->save();
            return response()->json(['status'=>true, 'message'=>"Data updated successfully"], 200);
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
        CustomerModel::where('id', $id)->update(['deleted_by' => Auth::user()->id]);
        $model=CustomerModel::where('id',$id)->delete();
        

        return redirect(route('customerlist'));
    }
    public function deletecustomer(Request $request)
    {
        try
        {   
            $model=CustomerModel::where('id',$request->id)->delete();
            return response()->json(['status'=>true,'message' => "Customer deleted successfully."], 200);
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
