<?php

namespace App\Models;
use App\Models\SubplateModel;

use Illuminate\Database\Eloquent\Model;

class ScanningModel extends Model
{
    protected $table = 'scan';

    public function subplates()
    {
        return $this->hasMany(SubplateModel::class, 'projectid');
    }
  
    public function customer()
    {
        return $this->belongsTo(CustomerModel::class, 'cname','id');
    }
  
}
