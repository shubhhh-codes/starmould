<?php

namespace App\Http\Controllers;

use App\Models\PrintingModel;
use App\Models\UserModel;
use App\Models\WorkModel;
use App\Models\CustomerModel;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Yajra\DataTables\DataTables as DataTables;

class PrintAdminController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        //
        return view('printadmin.index');
    }
    public function indexmobile(Request $request)
    {
        try
        {
            $data = PrintingModel::leftJoin('customers', 'print.cname', '=', 'customers.id')->select('print.*','customers.customername')->where("status","registered")->orderBy('created_at', 'desc')->get();
            return response()->json(['status'=>true,'data' => $data], 200);
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
    public function getData(Request $request)
    {
        if ($request->ajax()) {
            $data = PrintingModel::where("status","registered")->orderBy('created_at', 'desc');
            return DataTables::of($data)
            ->addIndexColumn()
            ->addColumn('cdate',function($row){
                return [
                    'display' => Carbon::parse($row->cdate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->cdate)->timestamp,
                ];
                // return Carbon::parse($row->cdate)->format('d-m-Y');
            })           
            ->addColumn('tdate',function($row){
                return [
                    'display' => Carbon::parse($row->tdate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->tdate)->timestamp,
                ];
                // return Carbon::parse($row->tdate)->format('d-m-Y');
            })
            ->addColumn('cname',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->cname)->get();
                $cname="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $cname=$value->customername;
                    }
                    
                }
                return $cname;
            })           
            ->addColumn('print_by', function($row){
                $data1 = UserModel::latest()->where("status","1")->get();
                 
                 $btn2 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="printby_'.$row->id.'" onchange="return changestatus1print(\'print_by\',this.value,\''.$row->id.'\');">';
                 $btn2.='<option value="0">Select</option>';
                 foreach ($data1 as $key => $value) {
                     # code...
                    // $btn2.='<option value="'.$value->id.'">'.$value->initials.'</option>';
                     if($value->id==$row->print_by){
                        $btn2.='<option value="'.$value->id.'" selected>'.$value->initials.'</option>';
                     }else{
                     $btn2.='<option value="'.$value->id.'">'.$value->initials.'</option>';
                     }
                 }
                 $btn2.= '</select>';
 
                  return $btn2;
             })
             ->addColumn('qc_by', function($row){
                $data1 = UserModel::latest()->where("status","1")->get();
                 
                 $btn1 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="qcby_'.$row->id.'" onchange="return changestatus1print(\'qc_by\',this.value,\''.$row->id.'\');">';
                 $btn1.='<option value="0">Select</option>';
                 foreach ($data1 as $key => $value) {
                     # code...
                     if($value->id==$row->qc_by){
                        $btn1.='<option value="'.$value->id.'" selected>'.$value->initials.'</option>';
                     }else{
                     $btn1.='<option value="'.$value->id.'">'.$value->initials.'</option>';
                     }
                 }
                 $btn1.= '</select>';
 
                  return $btn1;
             })
            //  ->addColumn('mail_done', function($row){

            //     $btn = '<input class="form-check-input" type="checkbox" id="formCheckcolor1" onchange="return changestatus(\''.$row->id.'\');">';

            //      return $btn;
            //  })
            ->addColumn('dispatch', function($row){

                   $btn = '<input class="form-check-input" type="checkbox" id="formCheckcolor2" onchange="return changestatus1(\''.$row->id.'\');" checked>';

                    return $btn;
            })
            ->order(function ($query) {
                
                // if (request()->has('name')) {
                //     $query->orderBy('name', 'asc');
                // }

                // if (request()->has('email')) {
                //     $query->orderBy('email', 'desc');
                // }
            })     
                ->addColumn('payment', function($row){
                    // $checked = ($row-> payment == 1) ? 'checked' : '';
                    // $btn = '<input class="form-check-input" type="checkbox" id="payment'.$row->id.'"' . $checked . ' name="payment" onchange="return changestatuspayment(\''.$row->id.'\');">';
    
                    return $row-> payment;
            })
            ->addColumn('paymentt', function($row){
                // $checked = ($row-> payment == 1) ? 'checked' : '';
                // $btn = '<input class="form-check-input" type="checkbox" id="payment'.$row->id.'"' . $checked . ' name="payment" onchange="return changestatuspayment(\''.$row->id.'\');">';
    
                return $row-> payment;
            })
            ->editColumn('payment', function($row){

                $checked = ($row-> payment == 1) ? 'checked' : '';
                $btn = '<input class="form-check-input" type="checkbox" id="payment'.$row->id.'"' . $checked . ' name="payment" onchange="return changestatuspayment(\''.$row->id.'\');">';

                 return $btn;
            })
            ->addColumn('ramount', function($row){

                $btn = '<input type="text" style="padding:0px;!important" id="ramount_'.$row->id.'" class="form-control" value="'.$row->ramount.'" onblur="return changeamount(\''.$row->id.'\');" >';

                 return $btn;
            })   
            ->addColumn("pr_printhr",function($row){
                $data = WorkModel::where('scan_print_id',$row->id)->get();
                $scanhr=0;
                foreach($data as $val){
                    $scanhr+=$val->print_hr;
                }
                return $scanhr;
            }) 
            ->addColumn('delete', function($row){
                $btn = '<a class="btn btn-outline-danger waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;" href="javascript:printDelete(\''.$row->id.'\')">Delete</a>';
    
                  return $btn;
              })
            // ->addColumn('action', function($row){

            //     $btn = '<a href="">Edit</a>';

            //      return $btn;
            // })
            ->setRowId(function($row){

                return "print_".$row->id;
            })
            ->rawColumns(['dispatch','print_by','qc_by','action','payment','ramount','delete'])
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
    public function store(Request $request)
    {
       
        dd($request);
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
    public function updatestatuspayment(Request $request){
        $model=PrintingModel::findOrFail($request->id);  
        $model->status=$request->status;
        $model->payment=$request->checkres;
        $model->updated_by=Auth::user()->id;
        $model->updated_at=Carbon::now()->toDateTimeString();
        $model->save();
     }
     public function updatestatuspaymentmobileprint(Request $request){
        try
        {
            $model=PrintingModel::findOrFail($request->id);  
            $model->status='registered';
            $model->payment=$request->checkres;
            $model->updated_by=Auth::user()->id;
            $model->updated_at=Carbon::now()->toDateTimeString();
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
    public function updateamount(Request $request){
        // dd($request);
         $model=PrintingModel::findOrFail($request->id);
         $model->ramount=$request->ramount;
         $model->updated_by=Auth::user()->role;
         $model->updated_at=Carbon::now()->toDateTimeString();
         $model->save();
     }
     public function updateamountmobileprint(Request $request){
        try
        {
            $model=PrintingModel::findOrFail($request->id);
            $model->ramount=$request->ramount;
            $model->updated_by=Auth::user()->role;
            $model->updated_at=Carbon::now()->toDateTimeString();
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
    public function updatestatusprintby(Request $request){
        //  dd($request);
         $model=PrintingModel::findOrFail($request->id);
         if($request->field=="print_by"){
         $model->print_by=$request->value;
        }else if($request->field=="qc_by"){
            $model->qc_by=$request->value;
        }
         $model->updated_by=Auth::user()->id;
         $model->updated_at=Carbon::now()->toDateTimeString();
         $model->save();
     }
    public function updatestatusprint(Request $request){
        //  dd($request);
         $model=PrintingModel::findOrFail($request->id);
         $model->status=$request->status;
         $model->dispatch=0;
         $model->updated_by=Auth::user()->id;
         $model->updated_at=Carbon::now()->toDateTimeString();
         $model->save();
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
        $model=PrintingModel::where("id", $id)->update(["status" => "completed"]);
        return redirect(route('printadmin.index'));
    }
    public function deleteprintdata(Request $request)
    {
        try
        {   
            $model=PrintingModel::where("id", $request->id)->update(["status" => "completed"]);
            return response()->json(['status'=>true,'message' => "Data deleted successfully."], 200);
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
