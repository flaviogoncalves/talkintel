#!/usr/bin/env python3
"""
TalkIntel AI Audio Transcription Utility
Processes audio files from TCR-Verbio directory and sends to TalkIntel AI for transcription
"""

import os
import sys
import requests
import json
import time
from pathlib import Path
from typing import Optional, Dict, Any
import argparse
from urllib.parse import quote
import subprocess
import tempfile

class TalkIntelTranscriber:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.sippulse.ai"
        self.session = requests.Session()
        self.session.headers.update({
            'api-key': api_key,
            'accept': 'application/json'
        })
    
    def convert_audio_with_ffmpeg(self, input_file: str) -> Optional[str]:
        """
        Convert audio file to proper MP3 format using FFmpeg
        
        Args:
            input_file: Path to input audio file
            
        Returns:
            Path to converted file or None if failed
        """
        try:
            # Create temporary file for converted audio
            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_file:
                output_file = temp_file.name
            
            print(f"🔄 Converting audio with FFmpeg: {os.path.basename(input_file)}")
            
            # FFmpeg command to convert to MP3 with proper encoding
            cmd = [
                'ffmpeg',
                '-i', input_file,
                '-acodec', 'libmp3lame',  # Use LAME MP3 encoder
                '-ab', '128k',            # 128kbps bitrate
                '-ar', '16000',           # 16kHz sample rate (good for speech)
                '-ac', '1',               # Mono channel
                '-y',                     # Overwrite output file
                output_file
            ]
            
            # Run FFmpeg conversion
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                timeout=60  # 1 minute timeout
            )
            
            if result.returncode == 0:
                print(f"✅ Audio converted successfully")
                return output_file
            else:
                print(f"❌ FFmpeg conversion failed:")
                print(f"   stdout: {result.stdout}")
                print(f"   stderr: {result.stderr}")
                # Clean up failed conversion file
                if os.path.exists(output_file):
                    os.unlink(output_file)
                return None
                
        except subprocess.TimeoutExpired:
            print(f"❌ FFmpeg conversion timed out")
            if 'output_file' in locals() and os.path.exists(output_file):
                os.unlink(output_file)
            return None
        except FileNotFoundError:
            print(f"❌ FFmpeg not found. Please install FFmpeg first.")
            return None
        except Exception as e:
            print(f"❌ Unexpected error during conversion: {e}")
            if 'output_file' in locals() and os.path.exists(output_file):
                os.unlink(output_file)
            return None
    
    def transcribe_file(self, audio_file_path: str, use_preset: bool = True) -> Optional[Dict[Any, Any]]:
        """
        Send audio file to TalkIntel AI for transcription
        
        Args:
            audio_file_path: Path to the audio file
            use_preset: Whether to use AudioIntelligenceDefault preset (simpler) or custom parameters
            
        Returns:
            API response as dictionary or None if failed
        """
        if not os.path.exists(audio_file_path):
            print(f"❌ File not found: {audio_file_path}")
            return None
            
        # Convert audio file with FFmpeg first
        converted_file = self.convert_audio_with_ffmpeg(audio_file_path)
        if not converted_file:
            print(f"❌ Failed to convert audio file: {audio_file_path}")
            return None
        
        # Use converted file for processing
        actual_file_path = converted_file
        file_name = os.path.basename(audio_file_path)  # Keep original name for display
        file_size = os.path.getsize(actual_file_path)
        print(f"🎵 Processing: {file_name} ({file_size:,} bytes converted)")
        
        # Prepare the request
        if use_preset:
            # Use the full parameters from your working curl command - essential for webhook format compatibility
            insights = {
                "summarization": True,
                "topic_detection": {"topics": []},
                "sentiment_analysis": {
                    "sentiments": [
                        "alegria", "confiança", "medo", "surpresa", "tristeza", "repugnância", 
                        "raiva", "antecipação", "neutro", "frustração", "satisfação", 
                        "empolgação", "decepção", "curiosidade", "amor", "ódio", "tédio", 
                        "confusão", "constrangimento", "culpa"
                    ]
                },
                "custom": [
                    {
                        "type": "string",
                        "title": "agent",
                        "description": "Identifique o nome do agente se houver sido falado."
                    },
                    {
                        "type": "string", 
                        "title": "client",
                        "description": "Identifique o nome do cliente se tiver sido falado"
                    },
                    {
                        "type": "boolean",
                        "title": "resolution", 
                        "description": "O problema foi resolvido?"
                    }
                ]
            }
            
            anonymize = {
                "sequence": 3,
                "entities": ["CNPJ", "CPF", "CREDIT_CARD", "LOCATION"]
            }
            
            # Build the full URL with all parameters as in your working curl command, properly URL encoded
            insights_encoded = quote(json.dumps(insights))
            anonymize_encoded = quote(json.dumps(anonymize))
            
            url = f"{self.base_url}/asr/transcribe?model=pulse-precision&language=pt&response_format=diarization&insights={insights_encoded}&anonymize={anonymize_encoded}"
            params = None
        else:
            # Custom parameters as in your curl command
            insights = {
                "summarization": True,
                "topic_detection": {"topics": []},
                "sentiment_analysis": {
                    "sentiments": [
                        "alegria", "confiança", "medo", "surpresa", "tristeza", "repugnância", 
                        "raiva", "antecipação", "neutro", "frustração", "satisfação", 
                        "empolgação", "decepção", "curiosidade", "amor", "ódio", "tédio", 
                        "confusão", "constrangimento", "culpa"
                    ]
                },
                "custom": [
                    {
                        "type": "string",
                        "title": "agent",
                        "description": "Identifique o nome do agente se houver sido falado."
                    },
                    {
                        "type": "string", 
                        "title": "client",
                        "description": "Identifique o nome do cliente se tiver sido falado"
                    },
                    {
                        "type": "boolean",
                        "title": "resolution", 
                        "description": "O problema foi resolvido?"
                    }
                ]
            }
            
            anonymize = {
                "sequence": 3,
                "entities": ["CNPJ", "CPF", "CREDIT_CARD", "LOCATION"]
            }
            
            url = f"{self.base_url}/asr/transcribe"
            params = {
                'model': 'pulse-precision',
                'language': 'pt',
                'response_format': 'diarization',
                'insights': json.dumps(insights),
                'anonymize': json.dumps(anonymize)
            }
        
        try:
            # Open and send the converted file
            with open(actual_file_path, 'rb') as audio_file:
                files = {'file': (file_name, audio_file, 'audio/mpeg')}
                
                print(f"🚀 Sending to TalkIntel AI...")
                print(f"🔗 URL: {url}")
                print(f"📋 Parameters: {params}")
                
                if params:
                    response = self.session.post(
                        url, 
                        params=params,
                        files=files,
                        timeout=300  # 5 minutes timeout
                    )
                else:
                    response = self.session.post(
                        url, 
                        files=files,
                        timeout=300  # 5 minutes timeout
                    )
                
                print(f"📡 Response Status: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"✅ Transcription successful!")
                    print(f"📊 Response keys: {list(result.keys()) if isinstance(result, dict) else 'Not a dict'}")
                    # Clean up converted file
                    if os.path.exists(converted_file):
                        os.unlink(converted_file)
                    return result
                else:
                    print(f"❌ Error: {response.status_code}")
                    print(f"📄 Response: {response.text}")
                    # Clean up converted file
                    if os.path.exists(converted_file):
                        os.unlink(converted_file)
                    return None
                    
        except requests.exceptions.RequestException as e:
            print(f"❌ Request failed: {e}")
            # Clean up converted file
            if os.path.exists(converted_file):
                os.unlink(converted_file)
            return None
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            # Clean up converted file
            if os.path.exists(converted_file):
                os.unlink(converted_file)
            return None
    
    def get_unique_files(self, directory_path: str) -> list:
        """
        Get unique audio files, avoiding duplicates with different extensions
        Prioritizes MP3 > WAV > FLAC > M4A > OGG > WMA
        
        Args:
            directory_path: Path to directory containing audio files
            
        Returns:
            List of unique audio file paths
        """
        if not os.path.exists(directory_path):
            print(f"❌ Directory not found: {directory_path}")
            return []
        
        audio_extensions = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.wma']
        extension_priority = {ext: i for i, ext in enumerate(audio_extensions)}
        
        # Group files by base name (without extension)
        file_groups = {}
        
        for file_path in Path(directory_path).rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in audio_extensions:
                base_name = file_path.stem  # filename without extension
                extension = file_path.suffix.lower()
                
                if base_name not in file_groups:
                    file_groups[base_name] = []
                
                file_groups[base_name].append({
                    'path': str(file_path),
                    'extension': extension,
                    'priority': extension_priority.get(extension, 999)
                })
        
        # Select best file from each group (lowest priority number = higher preference)
        unique_files = []
        for base_name, files in file_groups.items():
            # Sort by priority (MP3 first, then WAV, etc.)
            files.sort(key=lambda x: x['priority'])
            best_file = files[0]
            unique_files.append(best_file['path'])
            
            # Log duplicates found
            if len(files) > 1:
                duplicate_extensions = [f['extension'] for f in files[1:]]
                print(f"🔄 Found duplicates for '{base_name}': {duplicate_extensions} (using {best_file['extension']})")
        
        # Sort final list alphabetically
        unique_files.sort()
        return unique_files
    
    def process_directory(self, directory_path: str, webhook_endpoint: Optional[str] = None, max_files: Optional[int] = None) -> list:
        """
        Process unique audio files in a directory (avoiding duplicates with different extensions)
        
        Args:
            directory_path: Path to directory containing audio files
            webhook_endpoint: Optional webhook endpoint to send results to
            max_files: Maximum number of files to process (None for all)
            
        Returns:
            List of successful transcription results
        """
        # Get unique files (no duplicates)
        unique_files = self.get_unique_files(directory_path)
        
        if not unique_files:
            print(f"❌ No unique audio files found in {directory_path}")
            return []
        
        print(f"🎵 Found {len(unique_files)} unique audio files (duplicates filtered out)")
        
        if max_files:
            unique_files = unique_files[:max_files]
            print(f"📝 Processing first {len(unique_files)} files")
        
        results = []
        for i, audio_file in enumerate(unique_files, 1):
            print(f"\n{'='*60}")
            print(f"🎯 Processing unique file {i}/{len(unique_files)}")
            print(f"🎵 File: {os.path.basename(audio_file)}")
            print(f"{'='*60}")
            
            result = self.transcribe_file(audio_file)
            if result:
                results.append({
                    'file': audio_file,
                    'transcription': result
                })
                
                # Send to webhook if provided
                if webhook_endpoint:
                    self.send_to_webhook(result, webhook_endpoint)
            
            # Rate limiting - wait between requests
            if i < len(unique_files):
                print(f"⏳ Waiting 2 seconds before next file...")
                time.sleep(2)
        
        print(f"\n🎉 Processing complete! Successfully transcribed {len(results)}/{len(unique_files)} unique files")
        return results
    
    def send_to_webhook(self, transcription_data: dict, webhook_endpoint: str) -> bool:
        """
        Send transcription result to webhook endpoint
        
        Args:
            transcription_data: The transcription result from TalkIntel AI
            webhook_endpoint: The webhook URL to send data to
            
        Returns:
            True if successful, False otherwise
        """
        try:
            print(f"🔗 Sending to webhook: {webhook_endpoint}")
            
            # Format the data for the webhook (adjust as needed for your system)
            webhook_payload = {
                "transcription": transcription_data.get("transcript", ""),
                "diarization": transcription_data.get("diarization", []),
                "insights": transcription_data.get("insights", {}),
                "metadata": {
                    "processed_at": time.time(),
                    "source": "sippulse_ai_batch_processor"
                }
            }
            
            response = requests.post(
                webhook_endpoint,
                json=webhook_payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                print(f"✅ Webhook delivery successful")
                return True
            else:
                print(f"❌ Webhook failed: {response.status_code}")
                print(f"📄 Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Webhook error: {e}")
            return False

def main():
    parser = argparse.ArgumentParser(description='TalkIntel AI Audio Transcription Utility')
    parser.add_argument('--directory', '-d', default='./TCR-Verbio', 
                        help='Directory containing audio files (default: ./TCR-Verbio)')
    parser.add_argument('--api-key', '-k', default=os.environ.get('SIPPULSE_API_KEY'),
                        help='TalkIntel AI API key')
    parser.add_argument('--webhook', '-w', 
                        help='Webhook endpoint to send results to')
    parser.add_argument('--max-files', '-m', type=int,
                        help='Maximum number of files to process')
    parser.add_argument('--test', '-t', action='store_true',
                        help='Test with a single file')
    parser.add_argument('--no-preset', action='store_true',
                        help='Use custom parameters instead of preset')
    parser.add_argument('--list-files', action='store_true',
                        help='Only list unique files, do not process them')
    
    args = parser.parse_args()
    
    # Initialize transcriber
    transcriber = TalkIntelTranscriber(args.api_key)
    
    if args.list_files:
        # Just list unique files without processing
        print("🔍 Scanning for unique audio files...")
        unique_files = transcriber.get_unique_files(args.directory)
        
        if unique_files:
            print(f"\n✅ Found {len(unique_files)} unique audio files:")
            for i, file_path in enumerate(unique_files, 1):
                print(f"  {i:2d}. {os.path.basename(file_path)}")
        else:
            print(f"❌ No unique audio files found in {args.directory}")
        return
    
    if args.test:
        # Test with single file
        print("🧪 Test mode: processing single file")
        
        # Find first audio file in directory
        audio_extensions = {'.mp3', '.wav', '.flac', '.m4a', '.ogg', '.wma'}
        test_file = None
        
        if os.path.exists(args.directory):
            audio_files = []
            for file_path in Path(args.directory).rglob('*'):
                if file_path.is_file() and file_path.suffix.lower() in audio_extensions:
                    audio_files.append(str(file_path))
            
            # Sort by file extension to prioritize MP3 files 
            audio_files.sort(key=lambda x: (0 if x.endswith('.mp3') else 1, x))
            
            if audio_files:
                test_file = audio_files[0]
        
        if test_file:
            print(f"🎯 Testing with: {test_file}")
            result = transcriber.transcribe_file(test_file, use_preset=not args.no_preset)
            if result:
                print(f"🎉 Test successful!")
                # Pretty print a sample of the result
                print(f"📋 Sample result:")
                if isinstance(result, dict):
                    for key, value in list(result.items())[:3]:  # Show first 3 keys
                        if isinstance(value, str) and len(value) > 100:
                            print(f"  {key}: {value[:100]}...")
                        else:
                            print(f"  {key}: {value}")
            else:
                print(f"❌ Test failed")
        else:
            print(f"❌ No audio files found in {args.directory}")
    else:
        # Process all files
        results = transcriber.process_directory(
            args.directory, 
            webhook_endpoint=args.webhook,
            max_files=args.max_files
        )
        
        # Save results to file
        if results:
            output_file = f"transcription_results_{int(time.time())}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            print(f"📁 Results saved to: {output_file}")

if __name__ == "__main__":
    main()