<?php

namespace App\Http\Controllers;

use App\Models\CustomerModel;
use App\Models\GramModel;
use App\Models\PrintingModel;
use App\Models\UserModel;
use App\Models\WorkModel;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Yajra\DataTables\DataTables as DataTables;

class PrintingController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        //
        $currentDateTime1 = Carbon::now()->format('d/m/Y');
        $newDateTime1 = Carbon::now()->addDay(2)->format('d/m/Y');
        $printtotal = PrintingModel::where('status','pending')->count();
        $printby = PrintingModel::where('print_by',0)->where('status','pending')->count();
        $printqc = PrintingModel::where('qc_by',0)->where('status','pending')->count();
        return view('printing.index',["currentDateTime1"=>$currentDateTime1,"newDateTime1"=>$newDateTime1,"printtotal"=>$printtotal,"printby"=>$printby,"printqc"=>$printqc]);
    }
    public function indexmobile()
    {
        $data = PrintingModel::leftJoin('customers', 'print.cname', '=', 'customers.id')->select('print.*','customers.customername')->where("status","pending")->get();
       
        return response()->json(['status'=>true,'data' => $data], 200);
    }
    public function getData(Request $request)
    {
        if ($request->ajax()) {
            $data = PrintingModel::where("status","pending")->get();
            return DataTables::of($data)
            ->addIndexColumn()
            // ->addColumn('cdate',function($row){
            //     return Carbon::parse($row->cdate)->format('d-m-Y');
            // })     
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
            ->addColumn('tdate',function($row){
                return [
                    'display' => Carbon::parse($row->tdate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->tdate)->timestamp,
                ];
                // return Carbon::parse($row->tdate)->format('d-m-Y');
            })
            
            ->addColumn('cdate',function($row){
                return [
                    'display' => Carbon::parse($row->cdate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->cdate)->timestamp,
                ];
                // return Carbon::parse($row->cdate)->format('d-m-Y');
                
            })
            ->addColumn('print_by', function($row){
                $data1 = UserModel::latest()->where("status","1")->get();
                 
                 $btn2 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="printby_'.$row->id.'" onchange="return changestatus1print(\'print_by\',this.value,\''.$row->id.'\');">';
                 $btn2.='<option value="0">Select</option>';
                 foreach ($data1 as $key => $value) {
                     # code...
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

                   $btn = '<input class="form-check-input" type="checkbox" id="formCheckcolor2" onchange="return changestatus1(\''.$row->id.'\');">';

                    return $btn;
            })  
            ->addColumn('ramount', function($row){

                $btn = '<input type="text" class="form-control" style="padding:0px;!important" id="ramount_'.$row->id.'"  value="'.$row->ramount.'" onblur="return changeprintamount(\''.$row->id.'\');">';

                 return $btn;
            })        
            ->addColumn('action', function($row){
                $tdate = Carbon::parse($row->tdate);
                $row->tdate=$tdate->format('d/m/Y');
                $cdate = Carbon::parse($row->cdate);
                $row->cdate=$cdate->format('d/m/Y');
                $btn = '<a class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;" href="javascript:Edit1(\''.(str_replace("\"","\\'",json_encode($row,true))).'\')">Edit</a>';

                 return $btn;
            })
            ->setRowId(function($row){

                return "print_".$row->id;
            })
            ->rawColumns(['dispatch','print_by','qc_by','action','ramount'])
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
        if($request->id!=""){
            $model=PrintingModel::findOrFail($request->id);
            
            $model->gram=$request->gram;
            DB::enableQueryLog();
            $gramdata=GramModel::where("lessthan",">=",$request->gram)->where("graterthan","<=",$request->gram)->get();
            $fix=0;
            $multiply=0;
            foreach ($gramdata as $key => $value) {
                # code...
                $fix=$value->fix;
                $multiply=$value->multiply;
            }
            $amount=0;
            if($fix!=0){
                $amount=$fix;
            }else{
                $amount=$multiply*$request->gram;
            }
           
            $model->hr=($request->time==Null || $request->time=="")?0:$request->time;
            $model->print_by=0;
            $model->pr_printhr=0;
            $model->ramount=0;
            $model->dispatch=0;
            $model->qc_by=0;
            $model->payment=0;
            $model->cname=$request->cname1;
           // $data = PrintingModel::select('*')->where('cname', $request->cname1);
           // $totalproject=$data->count()+1;
          //  $model->projectid="P".$totalproject;
            $model->description=$request->description1;
            $model->amount=$amount;
            $model->save();
        }
        else{
            $model=new PrintingModel();
            $model->tdate=Carbon::createFromFormat('d/m/Y', $request->tdate1)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->rdate));
            $model->cdate=Carbon::createFromFormat('d/m/Y', $request->cdate1)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->cdate));
            $model->gram=$request->gram;
            DB::enableQueryLog();
            $gramdata=GramModel::where("lessthan",">=",$request->gram)->where("graterthan","<=",$request->gram)->get();
            $fix=0;
            $multiply=0;
            foreach ($gramdata as $key => $value) {
                # code...
                $fix=$value->fix;
                $multiply=$value->multiply;
            }
            $amount=0;
            if($fix!=0){
                $amount=$fix;
            }else{
                $amount=$multiply*$request->gram;
            }
           
            $model->hr=($request->time==Null || $request->time=="")?0:$request->time;;
            $model->print_by=0;
            $model->pr_printhr=0;
            $model->ramount=0;
            $model->dispatch=0;
            $model->qc_by=0;
            $model->cname=$request->cname1;
            $data = PrintingModel::select('*')->where('cname', $request->cname1);
            $totalproject=$data->count()+1;
            $model->projectid="P".$totalproject;
            $model->description=$request->description1;
            $model->amount=$amount;
            $model->payment=0;
            $model->save(); 
        }
        return redirect(route('scanlist'));
       // dd($request);
    }
    public function addprintdata(Request $request)
    {
        try
        {   
            if($request->id!=""){
                $model=PrintingModel::findOrFail($request->id);
                
                $model->gram=$request->gram;
                DB::enableQueryLog();
                $gramdata=GramModel::where("lessthan",">=",$request->gram)->where("graterthan","<=",$request->gram)->get();
                $fix=0;
                $multiply=0;
                foreach ($gramdata as $key => $value) {
                    # code...
                    $fix=$value->fix;
                    $multiply=$value->multiply;
                }
                $amount=0;
                if($fix!=0){
                    $amount=$fix;
                }else{
                    $amount=$multiply*$request->gram;
                }
               
                $model->hr=($request->time==Null || $request->time=="")?0:$request->time;
                $model->print_by=0;
                $model->pr_printhr=0;
                $model->ramount=0;
                $model->dispatch=0;
                $model->qc_by=0;
                $model->payment=0;
                $model->cname=$request->cname1;
               // $data = PrintingModel::select('*')->where('cname', $request->cname1);
               // $totalproject=$data->count()+1;
              //  $model->projectid="P".$totalproject;
                $model->description=$request->description1;
                $model->amount=$amount;
                $model->save();
                return response()->json(['status'=>true,'message'=>"Data updated successfully"], 200);
            }
            else{
                $model=new PrintingModel();
                $model->tdate=Carbon::createFromFormat('d/m/Y', $request->tdate1)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->rdate));
                $model->cdate=Carbon::createFromFormat('d/m/Y', $request->cdate1)->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->cdate));
                $model->gram=$request->gram;
                DB::enableQueryLog();
                $gramdata=GramModel::where("lessthan",">=",$request->gram)->where("graterthan","<=",$request->gram)->get();
                $fix=0;
                $multiply=0;
                foreach ($gramdata as $key => $value) {
                    # code...
                    $fix=$value->fix;
                    $multiply=$value->multiply;
                }
                $amount=0;
                if($fix!=0){
                    $amount=$fix;
                }else{
                    $amount=$multiply*$request->gram;
                }
               
                $model->hr=($request->time==Null || $request->time=="")?0:$request->time;;
                $model->print_by=0;
                $model->pr_printhr=0;
                $model->ramount=0;
                $model->dispatch=0;
                $model->qc_by=0;
                $model->cname=$request->cname1;
                $data = PrintingModel::select('*')->where('cname', $request->cname1);
                $totalproject=$data->count()+1;
                $model->projectid="P".$totalproject;
                $model->description=$request->description1;
                $model->amount=$amount;
                $model->payment=0;
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
         $data["printtotal"] = PrintingModel::where('status','pending')->count();
         $data["printby"] = PrintingModel::where('print_by',0)->where('status','pending')->count();
         $data["printqc"] = PrintingModel::where('qc_by',0)->where('status','pending')->count();
          print_r(json_encode($data));
     }
    //  public function updatestatusqcby(Request $request){
    //     //  dd($request);
    //      $model=PrintingModel::findOrFail($request->id);
    //      $model->qc_by=$request->qc;
    //      $model->updated_by=Auth::user()->id;
    //      $model->updated_at=Carbon::now()->toDateTimeString();
    //      $model->save();
    //  }
    public function updatestatusprint(Request $request){
        //  dd($request);
         $model=PrintingModel::findOrFail($request->id);
         $model->status=$request->status;
         $model->dispatch=1;
         $model->updated_by=Auth::user()->id;
         $model->updated_at=Carbon::now()->toDateTimeString();
         $model->save();
         $data["printtotal"] = PrintingModel::where('status','pending')->count();
         print_r(json_encode($data));

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
        print_r($request->id);
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
    }
}
