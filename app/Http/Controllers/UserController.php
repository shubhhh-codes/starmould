<?php

namespace App\Http\Controllers;
use App\Models\UserModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Yajra\DataTables\DataTables as DataTables;

class UserController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        //
        return view('user.index');
    }
    public function indexmobile(Request $request)
    {
        
        $data = UserModel::latest()->get();
        return response()->json(['status'=>true,'data' => $data], 200);
    }
    public function getData(Request $request)
    {
        if ($request->ajax()) {
            $data = UserModel::select('*');
            // $data = UserModel::latest()->get();
            // DB::table('users')->where('name', 'John')->first();
            return DataTables::of($data)
            ->addIndexColumn()  
            // ->rawColumns(['scan_by'])
            ->addColumn('action', function($row){
                $btn = '<a href="javascript:Edit(\''.(str_replace("\"","\\'",json_encode($row,true))).'\',\''.$row->id.'\')" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;">Edit</a>';
                   $btn .= '<a href="javascript:AskToDelete(\''.$row->id.'\')" class="btn btn-outline-danger waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;">Delete</a>';
                    return $btn;
            })
            ->addColumn('password', function($row){
                 return $row->password2;
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
    public function store(Request $request)
    {
        //
        $model=new UserModel();
        
        $model->name=$request->name;
        $model->username=$request->username;
        $model->initials=$request->initials;
        $model->usertype=$request->usertype;
        if($request->usertype == 'Admin' || $request->usertype == 'Manager' || $request->usertype == 'Supervisor' || $request->usertype == 'Designer'){
            $model->usersubtype='Skilled MP';
        }
        else{
            $model->usersubtype=$request->usersubtype;
        }
        if($request->usertype == 'Admin'){
            $model->role = 0;
        }
        elseif($request->usertype == 'Manager'){
            $model->role = 1;
        }
        elseif($request->usertype == 'Supervisor'){
            $model->role = 2;
        }
        elseif($request->usertype == 'Designer'){
            $model->role = 3;
        }
        else{
            $model->role = 4;
        }
        $model->email=$request->email;
        $model->password=Hash::make($request->password);
        $model->password2=$request->password;
        if($request->status == 'on')
        {
            $model->status=1; 
        }
        else
        {
            $model->status=0; 
        }
        $model->save();
        return redirect(route('userlist'));
    }
    public function adduser(Request $request)
    {
        //
        try
         {   
            $model=new UserModel();
            
            $model->name=$request->name;
            $model->username=$request->username;
            $model->initials=$request->initials;
            $model->usertype=$request->usertype;
            if($request->usertype == 'Admin' || $request->usertype == 'Manager' || $request->usertype == 'Supervisor' || $request->usertype == 'Designer'){
                $model->usersubtype='Skilled MP';
            }
            else{
                $model->usersubtype=$request->usersubtype;
            }
            if($request->usertype == 'Admin'){
                $model->role = 0;
            }
            elseif($request->usertype == 'Manager'){
                $model->role = 1;
            }
            elseif($request->usertype == 'Supervisor'){
                $model->role = 2;
            }
            elseif($request->usertype == 'Designer'){
                $model->role = 3;
            }
            else{
                $model->role = 4;
            }
            $model->email=$request->email;
            $model->password=Hash::make($request->password);
            $model->password2=$request->password;                                                                                         
            $model->save();
            return response()->json(['status'=>true,'message' => "User added successfully."], 200);
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
    public function updatedata(Request $request)
    {
        //
        $model=UserModel::findOrFail($request->id);
        
        $model->name=$request->name;
        $model->username=$request->username;
        $model->initials=$request->initials;
        $model->usertype=$request->usertype;
        if($request->usertype == 'Admin' || $request->usertype == 'Manager' || $request->usertype == 'Supervisor' || $request->usertype == 'Designer'){
            $model->usersubtype='Skilled MP';
        }
        else{
            $model->usersubtype=$request->usersubtype;
        }
        if($request->usertype == 'Admin'){
            $model->role = 0;
        }
        elseif($request->usertype == 'Manager'){
            $model->role = 1;
        }
        elseif($request->usertype == 'Supervisor'){
            $model->role = 2;
        }
        elseif($request->usertype == 'Designer'){
            $model->role = 3;
        }
        else{
            $model->role = 4;
        }
        $model->email=$request->email;
        $model->password=Hash::make($request->password);
        $model->password2=$request->password;
        if($request->status == 'on')
        {
            $model->status=1; 
        }
        else
        {
            $model->status=0; 
        }
        $model->save();
        return redirect(route('userlist'));
    }
    public function updateuser(Request $request)
    {
        try
        {   
            $model=UserModel::findOrFail($request->id);
        
            $model->name=$request->name;
            $model->username=$request->username;
            $model->initials=$request->initials;
            $model->usertype=$request->usertype;
            if($request->usertype == 'Admin' || $request->usertype == 'Manager' || $request->usertype == 'Supervisor' || $request->usertype == 'Designer'){
                $model->usersubtype='Skilled MP';
            }
            else{
                $model->usersubtype=$request->usersubtype;
            }
            if($request->usertype == 'Admin'){
                $model->role = 0;
            }
            elseif($request->usertype == 'Manager'){
                $model->role = 1;
            }
            elseif($request->usertype == 'Supervisor'){
                $model->role = 2;
            }
            elseif($request->usertype == 'Designer'){
                $model->role = 3;
            }
            else{
                $model->role = 4;
            }
            $model->email=$request->email;
            $model->password=Hash::make($request->password);
            $model->password2=$request->password;
            $model->save();
            return response()->json(['status'=>true,'message' => "User updated successfully."], 200);
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
        //  
    }
    public function checkinitial(Request $request) {
        $initials = $request->input('initials');
        // Perform a database query to check if the initial exists
        $initialExists = UserModel::where('initials', $initials)->exists();
        
        return response()->json(['initialExists' => $initialExists]);
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
        UserModel::where('id', $id)->update(['deleted_by' => Auth::user()->id]);
        $model=UserModel::where('id',$id)->delete();
      
        return redirect(route('userlist'));
    }
    public function deleteuser(Request $request)
    {
        //
        try
        {   
            
            $model=UserModel::where('id',$request->id)->delete();
            return response()->json(['status'=>true,'message' => "User deleted successfully."], 200);
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
